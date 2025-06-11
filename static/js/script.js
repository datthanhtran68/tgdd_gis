"use strict";

let chartInstance = null;
let isLoading = false;
let isEditMode = false;
let isDistrictsOn = true;
let isMapAddMode = false;
let storeMarkers = new Map();
let userMarker = null;
let tempMarker = null;
let districtsData = [];
let isAdmin = false;
let currentUsername = "";
let isHeatmapOn = false;

// Cached DOM elements
const DOM = {
  sidebar: document.getElementById("sidebar"),
  searchInput: document.getElementById("searchInput"),
  districtSelect: document.getElementById("districtSelect"),
  loadingSpinner: document.getElementById("loadingSpinner"),
  storeTableBody: document.querySelector("#storeTable tbody"),
  storeForm: document.getElementById("storeForm"),
  mapAddBtn: document.getElementById("mapAddBtn"),
  editModeBtn: document.getElementById("editModeBtn"),
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  changePasswordBtn: document.getElementById("changePasswordBtn"),
  addStoreBtn: document.getElementById("addStoreBtn"),
  clearRouteBtn: document.getElementById("clearRouteBtn"),
};

const API_BASE_URL = window.location.origin;

// Improved sanitization (assumes DOMPurify is available, fallback to basic)
function sanitizeHTML(str) {
  return window.DOMPurify ? DOMPurify.sanitize(str) : Object.assign(document.createElement("div"), { textContent: str }).innerHTML;
}

// Centralized error handling
function handleError(error, message) {
  console.error(`${message}:`, error);
  showAlert(message, "danger");
  DOM.loadingSpinner.style.display = "none";
}

// Reusable fetch function
async function fetchAPI(url, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${url}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.json();
  } catch (error) {
    throw error;
  }
}

// Alert function
function showAlert(message, type = "success") {
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  Object.assign(alertDiv.style, { position: "fixed", top: "20px", right: "20px", zIndex: "2000" });
  alertDiv.innerHTML = `
    ${sanitizeHTML(message)}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  document.body.appendChild(alertDiv);
  setTimeout(() => alertDiv.remove(), 3000);
}

// Toggle functions
function toggleHeatmap() {
  isHeatmapOn = !isHeatmapOn;
  if (!isHeatmapOn) heatLayer.setLatLngs([]);
  else loadStores(DOM.searchInput.value, DOM.districtSelect.value);
  document.getElementById("heatmap-text").textContent = isHeatmapOn ? "Tắt Heatmap" : "Bật Heatmap";
}

function toggleDistricts() {
  isDistrictsOn = !isDistrictsOn;
  if (isDistrictsOn) map.addLayer(districtLayer);
  else map.removeLayer(districtLayer);
  document.getElementById("district-text").textContent = isDistrictsOn ? "Tắt ranh giới" : "Bật ranh giới";
}

function toggleMapAddMode() {
  if (!isAdmin) return showAlert("Vui lòng đăng nhập với quyền admin!", "warning");
  isMapAddMode = !isMapAddMode;
  DOM.mapAddBtn.textContent = isMapAddMode ? "Tắt thêm bằng bản đồ" : "Thêm bằng bản đồ";
  showAlert(isMapAddMode ? "Nhấp vào bản đồ để chọn vị trí chi nhánh" : "Đã tắt chế độ thêm bằng bản đồ", isMapAddMode ? "info" : "success");
  if (!isMapAddMode && tempMarker) {
    map.removeLayer(tempMarker);
    tempMarker = null;
  }
}

function toggleMenu() {
  DOM.sidebar.classList.toggle("open");
}

// Show section with chart initialization
async function showSection(sectionId) {
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("open"));
  document.getElementById(sectionId).classList.add("open");
  document.querySelectorAll(".menu-item").forEach((item) => item.classList.remove("active"));
  event.currentTarget.classList.add("active");
  if (!DOM.sidebar.classList.contains("open")) toggleMenu();

  if (sectionId === "stats-section" && !chartInstance) {
    if (typeof Chart === "undefined") return showAlert("Không thể tải thư viện biểu đồ!", "danger");
    try {
      const data = await fetchAPI("/api/stats");
      const ctx = document.getElementById("districtChart").getContext("2d");
      chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels: Object.keys(data),
          datasets: [
            {
              label: "Số chi nhánh",
              data: Object.values(data),
              backgroundColor: "rgba(54, 162, 235, 0.2)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          scales: { y: { beginAtZero: true, ticks: { font: { size: 16 } } }, x: { ticks: { font: { size: 14 } } } },
          plugins: { legend: { labels: { font: { size: 16 } } } },
          maintainAspectRatio: false,
        },
      });
    } catch (error) {
      handleError(error, "Không thể tải thống kê!");
    }
  }
}

// Map initialization
let map, storeLayer, districtLayer, heatLayer, routingControl, userLocation;
if (typeof L === "undefined") {
  showAlert("Không thể tải thư viện bản đồ!", "danger");
} else {
  map = L.map("map").setView([21.0285, 105.8542], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  storeLayer = L.layerGroup().addTo(map);
  districtLayer = L.geoJSON(null, {
    style: { color: "blue", weight: 2, fillOpacity: 0.2 },
    onEachFeature: (feature, layer) => layer.bindPopup(feature.properties.name),
  }).addTo(map);
  heatLayer = L.heatLayer([], { radius: 15, blur: 10, maxZoom: 12 }).addTo(map);

  const storeIcon = L.icon({ iconUrl: "https://img.icons8.com/color/48/000000/shopping-cart.png", iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
  const tempIcon = L.icon({ iconUrl: "https://img.icons8.com/color/48/000000/marker.png", iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
  const userIcon = L.divIcon({ className: "user-location-marker", iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10] });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        userLocation = [coords.latitude, coords.longitude];
        userMarker = L.marker(userLocation, { icon: userIcon }).addTo(map).bindPopup("Vị trí của bạn").openPopup();
        map.setView(userLocation, 12);
      },
      (error) => handleError(error, "Không thể lấy vị trí của bạn!")
    );
  }

  map.on("click", async (e) => {
    if (isMapAddMode) {
      if (tempMarker) map.removeLayer(tempMarker);
      tempMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: tempIcon }).addTo(map);
      document.getElementById("latitude").value = e.latlng.lat.toFixed(6);
      document.getElementById("longitude").value = e.latlng.lng.toFixed(6);

      const point = turf.point([e.latlng.lng, e.latlng.lat]);
      let foundDistrict = null;
      districtsData.forEach((district) => {
        if (district.geom.type === "MultiPolygon") {
          district.geom.coordinates.forEach((coords) => {
            if (turf.booleanPointInPolygon(point, turf.polygon(coords))) foundDistrict = district.name;
          });
        }
      });

      document.getElementById("district").value = foundDistrict || "";
      showAlert(foundDistrict ? `Đã chọn quận: ${sanitizeHTML(foundDistrict)}` : "Không tìm thấy quận!", foundDistrict ? "info" : "warning");

      document.getElementById("storeModalLabel").textContent = "Thêm chi nhánh mới";
      DOM.storeForm.reset();
      DOM.storeForm.onsubmit = createStore;
      new bootstrap.Modal(document.getElementById("storeModal")).show();
      return;
    }

    if (DOM.sidebar.classList.contains("open")) toggleMenu();
    document.getElementById("store-list-section").classList.remove("open");
    document.getElementById("stats-section").classList.remove("open");
  });
}

// Load districts
async function loadDistricts() {
  try {
    districtsData = await fetchAPI("/api/districts");
    districtLayer.clearLayers();
    districtsData.forEach((district) => {
      L.geoJSON(district.geom, {
        style: { color: "blue", weight: 2, fillOpacity: 0.2 },
        onEachFeature: (feature, layer) => layer.bindPopup(sanitizeHTML(district.name)),
      }).addTo(districtLayer);
      const option = Object.assign(document.createElement("option"), { value: district.name, text: district.name });
      DOM.districtSelect.appendChild(option);
    });
  } catch (error) {
    handleError(error, "Không thể tải dữ liệu quận!");
  }
}

// Load stores
async function loadStores(query = "", district = "") {
  if (isLoading) return;
  isLoading = true;
  DOM.loadingSpinner.style.display = "block";
  storeLayer.clearLayers();
  storeMarkers.clear();
  if (isHeatmapOn) heatLayer.setLatLngs([]);

  try {
    const url = `/api/stores${query || district ? "?" : ""}${query ? `q=${encodeURIComponent(query)}` : ""}${district ? `${query ? "&" : ""}district=${encodeURIComponent(district)}` : ""}`;
    const start = performance.now();
    const data = await fetchAPI(url);
    const uniqueStores = Array.from(new Map(data.map((store) => [store.name, store])).values());

    uniqueStores.forEach((store) => {
      const marker = L.marker([store.latitude, store.longitude], { icon: storeIcon, draggable: isEditMode });
      const safeStoreName = store.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
      const storeId = safeStoreName.replace(/\s+/g, "_");
      const popupContent = `
        <div class="popup-header">${sanitizeHTML(safeStoreName)}</div>
        <div class="popup-info">
          <p><strong>Địa chỉ:</strong> ${sanitizeHTML(store.address)}</p>
          <p><strong>Số điện thoại:</strong> ${sanitizeHTML(store.phone)}</p>
          <p><strong>Giờ mở cửa:</strong> ${sanitizeHTML(store.open_hours)}</p>
          <p><strong>Quận:</strong> ${sanitizeHTML(store.district)}</p>
          <p><strong>Tọa độ:</strong> <span id="coords_${storeId}">${store.latitude}, ${store.longitude}</span></p>
        </div>
        <div class="popup-image">${store.image ? `<img src="${sanitizeHTML(store.image)}" alt="Store Image" />` : "<p>Chưa có ảnh</p>"}</div>
        <div class="popup-actions">
          <button class="btn btn-success" onclick="routeToStore(${store.latitude}, ${store.longitude})">Chỉ đường</button>
          ${isAdmin && isEditMode ? `<button class="btn btn-primary mt-2" onclick="saveNewLocation('${safeStoreName}', ${store.latitude}, ${store.longitude})">Lưu vị trí</button>` : ""}
        </div>
      `;
      marker.bindPopup(popupContent).addTo(storeLayer);
      storeMarkers.set(store.name, { marker, originalLat: store.latitude, originalLng: store.longitude });

      marker.on("dragend", (e) => {
        const newLatLng = marker.getLatLng();
        const coordsElement = document.getElementById(`coords_${storeId}`);
        if (coordsElement) coordsElement.textContent = `${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`;
        marker.getPopup().setContent(marker.getPopup().getContent().replace(new RegExp(`${store.latitude}, ${store.longitude}`), `${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`));
      });
    });

    if (isHeatmapOn && uniqueStores.length) heatLayer.setLatLngs(uniqueStores.map((store) => [store.latitude, store.longitude, 1]));
    updateStoreList(uniqueStores);
    console.log(`Store load time: ${performance.now() - start}ms`);
  } catch (error) {
    handleError(error, "Không thể tải danh sách cửa hàng!");
  } finally {
    isLoading = false;
    DOM.loadingSpinner.style.display = "none";
  }
}

// Update store list with event delegation
function updateStoreList(stores) {
  DOM.storeTableBody.innerHTML = "";
  stores.forEach((store, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${sanitizeHTML(store.name)}</td>
      <td>${sanitizeHTML(store.address)}</td>
      <td>${sanitizeHTML(store.district)}</td>
      <td>${isAdmin ? `<button class="btn btn-sm btn-warning me-1 edit-btn">Sửa</button><button class="btn btn-sm btn-danger delete-btn">Xóa</button>` : ""}</td>
    `;
    row.dataset.store = JSON.stringify(store);
    row.dataset.name = store.name;
    DOM.storeTableBody.appendChild(row);
  });

  DOM.storeTableBody.addEventListener("click", (e) => {
    if (e.target.classList.contains("edit-btn")) editStore(JSON.parse(e.target.closest("tr").dataset.store));
    if (e.target.classList.contains("delete-btn")) deleteStore(e.target.closest("tr").dataset.name);
  });
}

// Toggle edit mode
function toggleEditMode() {
  if (!isAdmin) return showAlert("Vui lòng đăng nhập với quyền admin!", "warning");
  isEditMode = !isEditMode;
  storeMarkers.forEach(({ marker }) => marker.dragging[isEditMode ? "enable" : "disable"]());
  DOM.editModeBtn.textContent = isEditMode ? "Tắt chỉnh sửa vị trí" : "Chỉnh sửa vị trí";
  showAlert(isEditMode ? "Đã bật chế độ chỉnh sửa vị trí" : "Đã tắt chế độ chỉnh sửa vị trí", isEditMode ? "success" : "info");
  loadStores();
}

// Save new location
async function saveNewLocation(storeName, originalLat, originalLng) {
  if (!isAdmin) return showAlert("Vui lòng đăng nhập với quyền admin!", "warning");
  const { marker } = storeMarkers.get(storeName) || {};
  if (!marker) return;

  const newLatLng = marker.getLatLng();
  try {
    const data = await fetchAPI("/api/stores", {
      method: "PUT",
      body: JSON.stringify({ name: storeName, latitude: newLatLng.lat, longitude: newLatLng.lng, original_name: storeName, originalLat, originalLng }),
    });
    showAlert(data.error || data.message, data.error ? "danger" : "success");
    if (!data.error) loadStores();
  } catch (error) {
    handleError(error, "Đã xảy ra lỗi khi lưu vị trí!");
  }
}

// Clear route
function clearRoute() {
  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
    DOM.clearRouteBtn.style.display = "none";
    showAlert("Đã tắt chỉ đường", "info");
  }
}

// Debounce with leading option
function debounce(func, wait, leading = false) {
  let timeout;
  return function (...args) {
    const context = this;
    if (leading && !timeout) func.apply(context, args);
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      if (!leading) func.apply(context, args);
      timeout = null;
    }, wait);
  };
}

// Search stores
DOM.searchInput.addEventListener("input", debounce(searchStores, 300, true));
function searchStores() {
  loadStores(DOM.searchInput.value, DOM.districtSelect.value);
}

// Create store
async function createStore(event) {
  event.preventDefault();
  if (!isAdmin) return showAlert("Vui lòng đăng nhập với quyền admin!", "warning");

  const store = {
    name: document.getElementById("name").value.trim(),
    address: document.getElementById("address").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    open_hours: document.getElementById("open_hours").value.trim(),
    district: document.getElementById("district").value.trim(),
    latitude: parseFloat(document.getElementById("latitude").value),
    longitude: parseFloat(document.getElementById("longitude").value),
  };

  if (!store.name || isNaN(store.latitude) || isNaN(store.longitude)) {
    showAlert("Vui lòng điền đầy đủ thông tin bắt buộc!", "warning");
    return;
  }

  DOM.loadingSpinner.style.display = "block";
  const fileInput = document.getElementById("image");
  if (fileInput.files[0]) {
    store.image = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(fileInput.files[0]);
    });
  }

  try {
    const data = await fetchAPI("/api/stores", { method: "POST", body: JSON.stringify(store) });
    showAlert(data.error || data.message, data.error ? "danger" : "success");
    if (!data.error) {
      loadStores();
      DOM.storeForm.reset();
      bootstrap.Modal.getInstance(document.getElementById("storeModal")).hide();
      if (tempMarker) map.removeLayer(tempMarker);
      tempMarker = null;
    }
  } catch (error) {
    handleError(error, "Đã xảy ra lỗi khi thêm chi nhánh!");
  } finally {
    DOM.loadingSpinner.style.display = "none";
  }
}

// Edit store
function editStore(store) {
  if (!isAdmin) return showAlert("Vui lòng đăng nhập với quyền admin!", "warning");
  document.getElementById("storeModalLabel").textContent = "Sửa chi nhánh";
  Object.assign(document.getElementById("name"), { value: store.name });
  Object.assign(document.getElementById("address"), { value: store.address });
  Object.assign(document.getElementById("phone"), { value: store.phone });
  Object.assign(document.getElementById("open_hours"), { value: store.open_hours });
  Object.assign(document.getElementById("district"), { value: store.district });
  Object.assign(document.getElementById("latitude"), { value: store.latitude });
  Object.assign(document.getElementById("longitude"), { value: store.longitude });

  new bootstrap.Modal(document.getElementById("storeModal")).show();
  DOM.storeForm.onsubmit = async (event) => {
    event.preventDefault();
    DOM.loadingSpinner.style.display = "block";
    const updatedStore = {
      name: document.getElementById("name").value.trim(),
      address: document.getElementById("address").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      open_hours: document.getElementById("open_hours").value.trim(),
      district: document.getElementById("district").value.trim(),
      latitude: parseFloat(document.getElementById("latitude").value),
      longitude: parseFloat(document.getElementById("longitude").value),
      original_name: store.name,
      image: store.image,
    };

    if (!updatedStore.name || isNaN(updatedStore.latitude) || isNaN(updatedStore.longitude)) {
      showAlert("Vui lòng điền đầy đủ thông tin bắt buộc!", "warning");
      DOM.loadingSpinner.style.display = "none";
      return;
    }

    const fileInput = document.getElementById("image");
    if (fileInput.files[0]) {
      updatedStore.image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(fileInput.files[0]);
      });
    }

    try {
      const data = await fetchAPI("/api/stores", { method: "PUT", body: JSON.stringify(updatedStore) });
      showAlert(data.error || data.message, data.error ? "danger" : "success");
      if (!data.error) {
        loadStores();
        DOM.storeForm.reset();
        document.getElementById("storeModalLabel").textContent = "Thêm chi nhánh mới";
        DOM.storeForm.onsubmit = createStore;
        bootstrap.Modal.getInstance(document.getElementById("storeModal")).hide();
      }
    } catch (error) {
      handleError(error, "Đã xảy ra lỗi khi cập nhật chi nhánh!");
    } finally {
      DOM.loadingSpinner.style.display = "none";
    }
  };
}

// Delete store
async function deleteStore(name) {
  if (!isAdmin) return showAlert("Vui lòng đăng nhập với quyền admin!", "warning");
  if (!confirm(`Xóa chi nhánh ${name}?`)) return;

  DOM.loadingSpinner.style.display = "block";
  try {
    const data = await fetchAPI(`/api/stores?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    showAlert(data.error || data.message, data.error ? "danger" : "success");
    if (!data.error) loadStores();
  } catch (error) {
    handleError(error, "Đã xảy ra lỗi khi xóa chi nhánh!");
  } finally {
    DOM.loadingSpinner.style.display = "none";
  }
}

// Route to store
function routeToStore(lat, lng) {
  if (!userLocation) return showAlert("Không thể xác định vị trí hiện tại!", "warning");
  if (routingControl) map.removeControl(routingControl);
  DOM.loadingSpinner.style.display = "block";

  routingControl = L.Routing.control({
    waypoints: [L.latLng(userLocation[0], userLocation[1]), L.latLng(lat, lng)],
    router: L.Routing.osrmv1({ serviceUrl: "https://router.project-osrm.org/route/v1", profile: "driving-car" }),
    lineOptions: { styles: [{ color: "blue", weight: 4 }] },
    createMarker: (i, waypoint) => (i === 0 ? userMarker : L.marker(waypoint.latLng, { icon: storeIcon })),
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    showAlternatives: false,
  }).addTo(map);

  routingControl.on("routesfound", ({ routes }) => {
    const { totalDistance, totalTime } = routes[0].summary;
    showAlert(`Lộ trình: ${totalDistance / 1000} km, ${Math.round(totalTime / 60)} phút`, "info");
    DOM.loadingSpinner.style.display = "none";
    DOM.clearRouteBtn.style.display = "block";
  });
}

// Login
async function login(event) {
  event.preventDefault();
  DOM.loadingSpinner.style.display = "block";
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const data = await fetchAPI("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
    if (data.success && data.isAdmin) {
      isAdmin = true;
      currentUsername = username;
      DOM.loginBtn.style.display = "none";
      DOM.logoutBtn.style.display = "block";
      DOM.changePasswordBtn.style.display = "block";
      DOM.addStoreBtn.style.display = "block";
      DOM.mapAddBtn.style.display = "block";
      DOM.editModeBtn.style.display = "block";
      showAlert("Đăng nhập thành công với quyền admin!", "success");
      loadStores();
    } else {
      showAlert("Tên đăng nhập hoặc mật khẩu không đúng!", "danger");
    }
    document.getElementById("loginForm").reset();
    bootstrap.Modal.getInstance(document.getElementById("loginModal")).hide();
  } catch (error) {
    handleError(error, "Đã xảy ra lỗi khi đăng nhập!");
  } finally {
    DOM.loadingSpinner.style.display = "none";
  }
}

// Logout
function logout() {
  isAdmin = false;
  currentUsername = "";
  DOM.loginBtn.style.display = "block";
  DOM.logoutBtn.style.display = "none";
  DOM.changePasswordBtn.style.display = "none";
  DOM.addStoreBtn.style.display = "none";
  DOM.mapAddBtn.style.display = "none";
  DOM.editModeBtn.style.display = "none";
  showAlert("Đăng xuất thành công!", "info");
  loadStores();
}

// Change password
async function changePassword(event) {
  event.preventDefault();
  DOM.loadingSpinner.style.display = "block";
  const oldPassword = document.getElementById("oldPassword").value.trim();
  const newPassword = document.getElementById("newPassword").value.trim();

  try {
    const data = await fetchAPI("/api/change-password", {
      method: "POST",
      body: JSON.stringify({ username: currentUsername, oldPassword, newPassword }),
    });
    showAlert(data.success ? "Đổi mật khẩu thành công!" : data.message, data.success ? "success" : "danger");
    if (data.success) {
      document.getElementById("changePasswordForm").reset();
      bootstrap.Modal.getInstance(document.getElementById("changePasswordModal")).hide();
    }
  } catch (error) {
    handleError(error, "Đã xảy ra lỗi khi đổi mật khẩu!");
  } finally {
    DOM.loadingSpinner.style.display = "none";
  }
}

// Event listeners
document.getElementById("loginForm").onsubmit = login;
document.getElementById("changePasswordForm").onsubmit = changePassword;

// Initialize
loadDistricts();
loadStores();
