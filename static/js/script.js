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
let currentUsername = '';
let isHeatmapOn = false;

const API_BASE_URL = window.location.origin;

function sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '2000';
    alertDiv.innerHTML = `
        ${sanitizeHTML(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
}

function toggleHeatmap() {
    isHeatmapOn = !isHeatmapOn;
    if (!isHeatmapOn) heatLayer.setLatLngs([]);
    else loadStores(document.getElementById('searchInput').value, document.getElementById('districtSelect').value);
    document.getElementById('heatmap-text').textContent = isHeatmapOn ? 'Tắt Heatmap' : 'Bật Heatmap';
}

function toggleDistricts() {
    isDistrictsOn = !isDistrictsOn;
    if (isDistrictsOn) map.addLayer(districtLayer);
    else map.removeLayer(districtLayer);
    document.getElementById('district-text').textContent = isDistrictsOn ? 'Tắt ranh giới' : 'Bật ranh giới';
}

function toggleMapAddMode() {
    if (!isAdmin) {
        showAlert('Vui lòng đăng nhập với quyền admin để sử dụng chức năng này!', 'warning');
        return;
    }
    isMapAddMode = !isMapAddMode;
    document.getElementById('map-add-text').textContent = isMapAddMode ? 'Tắt thêm bằng bản đồ' : 'Thêm bằng bản đồ';
    showAlert(isMapAddMode ? 'Nhấp vào bản đồ để chọn vị trí chi nhánh' : 'Đã tắt chế độ thêm bằng bản đồ', isMapAddMode ? 'info' : 'success');
    if (!isMapAddMode && tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
}

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open', !sidebar.classList.contains('open'));
}

function showSection(sectionId) {
    document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('open'));
    document.getElementById(sectionId).classList.add('open');

    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');

    const sidebar = document.getElementById('sidebar');
    if (!sidebar.classList.contains('open')) toggleMenu();

    if (sectionId === 'stats-section' && !chartInstance) {
        if (typeof Chart === 'undefined') {
            showAlert('Không thể tải thư viện biểu đồ. Vui lòng kiểm tra kết nối.', 'danger');
            return;
        }
        fetch(`${API_BASE_URL}/api/stats`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                const ctx = document.getElementById('districtChart').getContext('2d');
                if (chartInstance) chartInstance.destroy();
                chartInstance = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: Object.keys(data),
                        datasets: [{
                            label: 'Số chi nhánh',
                            data: Object.values(data),
                            backgroundColor: 'rgba(54, 162, 235, 0.2)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        scales: {
                            y: { beginAtZero: true, ticks: { font: { size: 16 } } },
                            x: { ticks: { font: { size: 14 } } }
                        },
                        plugins: {
                            legend: { labels: { font: { size: 16 } } }
                        },
                        maintainAspectRatio: false
                    }
                });
            })
            .catch(error => {
                console.error('Error loading stats:', error);
                showAlert('Không thể tải thống kê. Vui lòng kiểm tra kết nối hoặc dữ liệu.', 'danger');
            });
    }
}

if (typeof L === 'undefined') {
    showAlert('Không thể tải thư viện bản đồ. Vui lòng kiểm tra kết nối.', 'danger');
} else {
    var map = L.map('map').setView([21.0285, 105.8542], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    var storeLayer = L.layerGroup().addTo(map);
    var districtLayer = L.geoJSON(null, {
        style: { color: 'blue', weight: 2, fillOpacity: 0.2 },
        onEachFeature: function (feature, layer) { layer.bindPopup(feature.properties.name); }
    }).addTo(map);
    var heatLayer = L.heatLayer([], { radius: 15, blur: 10, maxZoom: 12 }).addTo(map);
    var routingControl = null;
    var userLocation = null;

    var storeIcon = L.icon({ iconUrl: 'https://img.icons8.com/color/48/000000/shopping-cart.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
    var tempIcon = L.icon({ iconUrl: 'https://img.icons8.com/color/48/000000/marker.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
    var userIcon = L.divIcon({ className: 'user-location-marker', iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10] });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                userLocation = [position.coords.latitude, position.coords.longitude];
                userMarker = L.marker(userLocation, { icon: userIcon }).addTo(map).bindPopup('Vị trí của bạn').openPopup();
                map.setView(userLocation, 12);
            },
            error => {
                console.error('Geolocation error:', error);
                showAlert('Không thể lấy vị trí của bạn. Vui lòng kiểm tra quyền định vị.', 'warning');
            }
        );
    }

    map.on('click', function(e) {
        if (isMapAddMode) {
            if (tempMarker) map.removeLayer(tempMarker);
            tempMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: tempIcon }).addTo(map);

            document.getElementById('latitude').value = e.latlng.lat.toFixed(6);
            document.getElementById('longitude').value = e.latlng.lng.toFixed(6);

            const point = turf.point([e.latlng.lng, e.latlng.lat]);
            let foundDistrict = null;
            districtsData.forEach(district => {
                if (district.geom.type === 'MultiPolygon') {
                    district.geom.coordinates.forEach(polygonCoords => {
                        const polygon = turf.polygon(polygonCoords);
                        if (turf.booleanPointInPolygon(point, polygon)) foundDistrict = district.name;
                    });
                }
            });
            if (foundDistrict) {
                document.getElementById('district').value = foundDistrict;
                showAlert(`Đã tự động chọn quận: ${sanitizeHTML(foundDistrict)}`, 'info');
            } else {
                document.getElementById('district').value = '';
                showAlert('Không tìm thấy quận cho vị trí này', 'warning');
            }

            document.getElementById('storeModalLabel').textContent = 'Thêm chi nhánh mới';
            document.getElementById('name').value = '';
            document.getElementById('address').value = '';
            document.getElementById('phone').value = '';
            document.getElementById('open_hours').value = '';
            document.getElementById('image').value = '';
            document.getElementById('storeForm').onsubmit = createStore;

            const modal = new bootstrap.Modal(document.getElementById('storeModal'));
            modal.show();
            return;
        }

        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('open')) toggleMenu();
        const storeListSection = document.getElementById('store-list-section');
        if (storeListSection.classList.contains('open')) storeListSection.classList.remove('open');
        const statsSection = document.getElementById('stats-section');
        if (statsSection.classList.contains('open')) statsSection.classList.remove('open');
    });
}

fetch(`${API_BASE_URL}/api/districts`)
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        districtsData = data;
        districtLayer.clearLayers();
        data.forEach(district => {
            L.geoJSON(district.geom, {
                style: { color: 'blue', weight: 2, fillOpacity: 0.2 },
                onEachFeature: function (feature, layer) { layer.bindPopup(sanitizeHTML(district.name)); }
            }).addTo(districtLayer);
        });
        const select = document.getElementById('districtSelect');
        data.forEach(district => {
            const option = document.createElement('option');
            option.value = district.name;
            option.text = district.name;
            select.appendChild(option);
        });
    })
    .catch(error => {
        console.error('Error loading districts:', error);
        showAlert('Không thể tải dữ liệu quận. Vui lòng kiểm tra kết nối.', 'danger');
    });

function loadStores(query = '', district = '') {
    if (isLoading) return;
    isLoading = true;
    document.getElementById('loadingSpinner').style.display = 'block';
    storeLayer.clearLayers();
    storeMarkers.clear();
    if (isHeatmapOn) heatLayer.setLatLngs([]);
    const url = `${API_BASE_URL}/api/stores${query || district ? '?' : ''}${query ? `q=${encodeURIComponent(query)}` : ''}${district ? `${query ? '&' : ''}district=${encodeURIComponent(district)}` : ''}`;
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            const uniqueStores = Array.from(new Map(data.map(store => [store.name, store])).values());
            uniqueStores.forEach(store => {
                const marker = L.marker([store.latitude, store.longitude], { icon: storeIcon, draggable: isEditMode });
                const safeStoreName = store.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                const storeId = safeStoreName.replace(/\s+/g, '_');
                const popupContent = `
                    <div class="popup-header">${sanitizeHTML(safeStoreName)}</div>
                    <div class="popup-info">
                        <p><strong>Địa chỉ:</strong> ${sanitizeHTML(store.address)}</p>
                        <p><strong>Số điện thoại:</strong> ${sanitizeHTML(store.phone)}</p>
                        <p><strong>Giờ mở cửa:</strong> ${sanitizeHTML(store.open_hours)}</p>
                        <p><strong>Quận:</strong> ${sanitizeHTML(store.district)}</p>
                        <p><strong>Tọa độ:</strong> <span id="coords_${storeId}">${store.latitude}, ${store.longitude}</span></p>
                    </div>
                    <div class="popup-image">
                        ${store.image ? `<img src="${sanitizeHTML(store.image)}" alt="Store Image" />` : '<p>Chưa có ảnh</p>'}
                    </div>
                    <div class="popup-actions">
                        <button class="btn btn-success" onclick="routeToStore(${store.latitude}, ${store.longitude})">Chỉ đường</button>
                        ${isAdmin && isEditMode ? `<button class="btn btn-primary mt-2" onclick="saveNewLocation('${safeStoreName}', ${store.latitude}, ${store.longitude})">Lưu vị trí</button>` : ''}
                    </div>
                `;
                marker.bindPopup(popupContent).addTo(storeLayer);
                storeMarkers.set(store.name, { marker: marker, originalLat: store.latitude, originalLng: store.longitude });

                marker.on('dragend', function(e) {
                    const newLatLng = marker.getLatLng();
                    const coordsElement = document.getElementById(`coords_${storeId}`);
                    if (coordsElement) coordsElement.textContent = `${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`;
                    marker.getPopup().setContent(marker.getPopup().getContent().replace(new RegExp(`${store.latitude}, ${store.longitude}`), `${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`));
                });
            });
            if (isHeatmapOn && uniqueStores.length > 0) {
                const heatPoints = uniqueStores.map(store => [store.latitude, store.longitude, 1]);
                heatLayer.setLatLngs(heatPoints);
            }
            updateStoreList(uniqueStores);
            document.getElementById('loadingSpinner').style.display = 'none';
            isLoading = false;
        })
        .catch(error => {
            console.error('Error loading stores:', error);
            showAlert('Không thể tải danh sách cửa hàng. Vui lòng thử lại.', 'danger');
            document.getElementById('loadingSpinner').style.display = 'none';
            isLoading = false;
        });
}

function updateStoreList(stores) {
    const tbody = document.querySelector('#storeTable tbody');
    tbody.innerHTML = '';
    stores.forEach((store, index) => {
        const row = document.createElement('tr');
        const safeStoreName = store.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
        const actions = isAdmin
            ? `<button class="btn btn-sm btn-warning me-1" onclick='editStore(${JSON.stringify(store).replace(/'/g, "\\'")})'>Sửa</button>
               <button class="btn btn-sm btn-danger" onclick='deleteStore("${safeStoreName}")'>Xóa</button>`
            : '';
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${sanitizeHTML(store.name)}</td>
            <td>${sanitizeHTML(store.address)}</td>
            <td>${sanitizeHTML(store.district)}</td>
            <td>${actions}</td>
        `;
        tbody.appendChild(row);
    });
}

function toggleEditMode() {
    if (!isAdmin) {
        showAlert('Vui lòng đăng nhập với quyền admin để sử dụng chức năng này!', 'warning');
        return;
    }
    isEditMode = !isEditMode;
    storeMarkers.forEach((value, key) => {
        const marker = value.marker;
        marker.dragging[isEditMode ? 'enable' : 'disable']();
    });
    document.getElementById('edit-mode-text').textContent = isEditMode ? 'Tắt chỉnh sửa vị trí' : 'Chỉnh sửa vị trí';
    showAlert(isEditMode ? 'Đã bật chế độ chỉnh sửa vị trí' : 'Đã tắt chế độ chỉnh sửa vị trí', isEditMode ? 'success' : 'info');
    loadStores();
}

function saveNewLocation(storeName, originalLat, originalLng) {
    if (!isAdmin) {
        showAlert('Vui lòng đăng nhập với quyền admin để sử dụng chức năng này!', 'warning');
        return;
    }
    const markerData = storeMarkers.get(storeName);
    if (!markerData) return;

    const marker = markerData.marker;
    const newLatLng = marker.getLatLng();
    const updatedStore = {
        name: storeName,
        latitude: newLatLng.lat,
        longitude: newLatLng.lng,
        original_name: storeName,
        originalLat: originalLat,
        originalLng: originalLng
    };

    fetch(`${API_BASE_URL}/api/stores`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStore)
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showAlert(data.error, 'danger');
            } else {
                showAlert(data.message, 'success');
                loadStores();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Đã xảy ra lỗi khi lưu vị trí. Vui lòng thử lại.', 'danger');
        });
}

function clearRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
        document.getElementById('clearRouteBtn').style.display = 'none';
        showAlert('Đã tắt chỉ đường', 'info');
    }
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function searchStores() {
    const query = document.getElementById('searchInput').value;
    const district = document.getElementById('districtSelect').value;
    loadStores(query, district);
}

document.getElementById('searchInput').addEventListener('input', debounce(searchStores, 300));

function createStore(event) {
    event.preventDefault();
    if (!isAdmin) {
        showAlert('Vui lòng đăng nhập với quyền admin để sử dụng chức năng này!', 'warning');
        return;
    }
    const store = {
        name: document.getElementById('name').value,
        address: document.getElementById('address').value,
        phone: document.getElementById('phone').value,
        open_hours: document.getElementById('open_hours').value,
        district: document.getElementById('district').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value)
    };
    if (!store.name || isNaN(store.latitude) || isNaN(store.longitude)) {
        showAlert('Vui lòng điền đầy đủ thông tin bắt buộc.', 'warning');
        return;
    }
    document.getElementById('loadingSpinner').style.display = 'block';
    const fileInput = document.getElementById('image');
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            store.image = e.target.result;
            sendStoreCreateRequest(store);
        };
        reader.readAsDataURL(file);
    } else {
        sendStoreCreateRequest(store);
    }
}

function sendStoreCreateRequest(store) {
    fetch(`${API_BASE_URL}/api/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store)
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showAlert(data.error, 'danger');
            } else {
                showAlert(data.message, 'success');
                loadStores();
                document.getElementById('storeForm').reset();
                bootstrap.Modal.getInstance(document.getElementById('storeModal')).hide();
                if (tempMarker) {
                    map.removeLayer(tempMarker);
                    tempMarker = null;
                }
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Đã xảy ra lỗi khi thêm chi nhánh. Vui lòng thử lại.', 'danger');
        })
        .finally(() => {
            document.getElementById('loadingSpinner').style.display = 'none';
        });
}

function editStore(store) {
    if (!isAdmin) {
        showAlert('Vui lòng đăng nhập với quyền admin để sử dụng chức năng này!', 'warning');
        return;
    }
    document.getElementById('storeModalLabel').textContent = 'Sửa chi nhánh';
    document.getElementById('name').value = store.name;
    document.getElementById('address').value = store.address;
    document.getElementById('phone').value = store.phone;
    document.getElementById('open_hours').value = store.open_hours;
    document.getElementById('district').value = store.district;
    document.getElementById('latitude').value = store.latitude;
    document.getElementById('longitude').value = store.longitude;
    const modal = new bootstrap.Modal(document.getElementById('storeModal'));
    modal.show();
    document.getElementById('storeForm').onsubmit = function(event) {
        event.preventDefault();
        document.getElementById('loadingSpinner').style.display = 'block';
        const fileInput = document.getElementById('image');
        const file = fileInput.files[0];
        const updatedStore = {
            name: document.getElementById('name').value,
            address: document.getElementById('address').value,
            phone: document.getElementById('phone').value,
            open_hours: document.getElementById('open_hours').value,
            district: document.getElementById('district').value,
            latitude: parseFloat(document.getElementById('latitude').value),
            longitude: parseFloat(document.getElementById('longitude').value),
            original_name: store.name
        };
        if (!updatedStore.name || isNaN(updatedStore.latitude) || isNaN(updatedStore.longitude)) {
            showAlert('Vui lòng điền đầy đủ thông tin bắt buộc.', 'warning');
            document.getElementById('loadingSpinner').style.display = 'none';
            return;
        }
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                updatedStore.image = e.target.result;
                sendStoreUpdateRequest(updatedStore);
            };
            reader.readAsDataURL(file);
        } else {
            updatedStore.image = store.image;
            sendStoreUpdateRequest(updatedStore);
        }
    };
}

function sendStoreUpdateRequest(updatedStore) {
    fetch(`${API_BASE_URL}/api/stores`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStore)
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.error) {
                showAlert(data.error, 'danger');
            } else {
                showAlert(data.message, 'success');
                loadStores();
                document.getElementById('storeForm').reset();
                bootstrap.Modal.getInstance(document.getElementById('storeModal')).hide();
                document.getElementById('storeModalLabel').textContent = 'Thêm chi nhánh mới';
                document.getElementById('storeForm').onsubmit = createStore;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Đã xảy ra lỗi khi cập nhật chi nhánh. Vui lòng thử lại.', 'danger');
        })
        .finally(() => {
            document.getElementById('loadingSpinner').style.display = 'none';
        });
}

function deleteStore(name) {
    if (!isAdmin) {
        showAlert('Vui lòng đăng nhập với quyền admin để sử dụng chức năng này!', 'warning');
        return;
    }
    if (confirm(`Xóa chi nhánh ${name}?`)) {
        document.getElementById('loadingSpinner').style.display = 'block';
        fetch(`${API_BASE_URL}/api/stores?name=${encodeURIComponent(name)}`, {
            method: 'DELETE'
        })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    showAlert(data.error, 'danger');
                } else {
                    showAlert(data.message, 'success');
                    loadStores();
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert('Đã xảy ra lỗi khi xóa chi nhánh. Vui lòng thử lại.', 'danger');
            })
            .finally(() => {
                document.getElementById('loadingSpinner').style.display = 'none';
            });
    }
}

function routeToStore(lat, lng) {
    if (!userLocation) {
        showAlert('Không thể xác định vị trí hiện tại. Vui lòng bật định vị.', 'warning');
        return;
    }
    if (routingControl) map.removeControl(routingControl);
    document.getElementById('loadingSpinner').style.display = 'block';
    routingControl = L.Routing.control({
        waypoints: [L.latLng(userLocation[0], userLocation[1]), L.latLng(lat, lng)],
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: 'driving-car' }),
        lineOptions: { styles: [{ color: 'blue', weight: 4 }] },
        createMarker: function(i, waypoint, n) { return i === 0 ? userMarker : L.marker(waypoint.latLng, { icon: storeIcon }); },
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: true,
        showAlternatives: false
    }).addTo(map);
    routingControl.on('routesfound', function(e) {
        const routes = e.routes;
        const summary = e.routes[0].summary;
        const distance = (summary.totalDistance / 1000).toFixed(2);
        const time = Math.round(summary.totalTime / 60);
        showAlert(`Lộ trình: Khoảng cách: ${distance} km, Thời gian: ${time} phút`, 'info');
        document.getElementById('loadingSpinner').style.display = 'none';
        document.getElementById('clearRouteBtn').style.display = 'block';
    });
}

function showLoginModal() {
    const modal = new bootstrap.Modal(document.getElementById('loginModal'));
    modal.show();
}

function login(event) {
    event.preventDefault();
    document.getElementById('loadingSpinner').style.display = 'block';
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.success && data.isAdmin) {
                isAdmin = true;
                currentUsername = username;
                document.getElementById('loginBtn').style.display = 'none';
                document.getElementById('logoutBtn').style.display = 'block';
                document.getElementById('changePasswordBtn').style.display = 'block';
                document.getElementById('addStoreBtn').style.display = 'block';
                document.getElementById('mapAddBtn').style.display = 'block';
                document.getElementById('editModeBtn').style.display = 'block';
                showAlert('Đăng nhập thành công với quyền admin!', 'success');
                loadStores();
            } else {
                showAlert('Tên đăng nhập hoặc mật khẩu không đúng, hoặc không có quyền admin!', 'danger');
            }
            document.getElementById('loginForm').reset();
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.', 'danger');
        })
        .finally(() => {
            document.getElementById('loadingSpinner').style.display = 'none';
        });
}

function logout() {
    isAdmin = false;
    currentUsername = '';
    document.getElementById('loginBtn').style.display = 'block';
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('changePasswordBtn').style.display = 'none';
    document.getElementById('addStoreBtn').style.display = 'none';
    document.getElementById('mapAddBtn').style.display = 'none';
    document.getElementById('editModeBtn').style.display = 'none';
    showAlert('Đăng xuất thành công!', 'info');
    loadStores();
}

function showChangePasswordModal() {
    const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
    modal.show();
}

function changePassword(event) {
    event.preventDefault();
    document.getElementById('loadingSpinner').style.display = 'block';
    const username = currentUsername;
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    fetch(`${API_BASE_URL}/api/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, oldPassword, newPassword })
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showAlert('Đổi mật khẩu thành công!', 'success');
                document.getElementById('changePasswordForm').reset();
                bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
            } else {
                showAlert(data.message, 'danger');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Đã xảy ra lỗi khi đổi mật khẩu. Vui lòng thử lại.', 'danger');
        })
        .finally(() => {
            document.getElementById('loadingSpinner').style.display = 'none';
        });
}

document.getElementById('loginForm').onsubmit = login;
document.getElementById('changePasswordForm').onsubmit = changePassword;
loadStores();
