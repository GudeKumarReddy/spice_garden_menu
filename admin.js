let adminPassword = "";
let state = null;
let itemFilter = "ALL";

const $ = id => document.getElementById(id);

function driveImageUrl(url) {
  const value = String(url || "");
  const match =
    value.match(/\/d\/([^/]+)/) ||
    value.match(/[?&]id=([^&]+)/);
  return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w500` : value;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[ch]));
}

async function api(action, payload = {}) {
  if (!API_URL || API_URL.includes("PASTE_YOUR")) {
    throw new Error("Add your Apps Script Web App URL in config.js.");
  }

  const body = new URLSearchParams({
    action,
    password: adminPassword,
    ...payload
  });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body
  });

  if (!response.ok) throw new Error("Server request failed.");
  const result = await response.json();
  if (!result.success) throw new Error(result.error || "Request failed.");
  return result.data;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getFilePayload(inputId) {
  const file = $(inputId).files[0];
  if (!file) return { base64: "", name: "" };

  if (file.size > 3 * 1024 * 1024) {
    throw new Error("Image must be 3 MB or smaller. 1200×900 JPG under 500 KB is recommended.");
  }

  return {
    base64: await fileToBase64(file),
    name: file.name
  };
}

async function login() {
  adminPassword = $("password").value;
  $("loginMessage").textContent = "";

  try {
    state = await api("admin_data");
    $("loginCard").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    renderAll();
  } catch (error) {
    adminPassword = "";
    $("loginMessage").textContent = error.message;
  }
}

function renderAll() {
  renderSettings();
  renderCategories();
  renderCategoryOptions();
  renderItems();
}

function renderSettings() {
  const s = state.restaurant || {};
  [
    "restaurant_name", "phone", "whatsapp", "email", "address",
    "description", "working_hours", "developer_name", "developer_phone"
  ].forEach(key => {
    $(key).value = s[key] || "";
  });
}

async function saveSettings() {
  $("settingsMessage").textContent = "Saving...";
  $("settingsMessage").className = "";

  try {
    const logo = await getFilePayload("logoFile");
    state = await api("save_settings", {
      restaurant_name: $("restaurant_name").value.trim(),
      phone: $("phone").value.trim(),
      whatsapp: $("whatsapp").value.trim(),
      email: $("email").value.trim(),
      address: $("address").value.trim(),
      description: $("description").value.trim(),
      working_hours: $("working_hours").value.trim(),
      developer_name: $("developer_name").value.trim(),
      developer_phone: $("developer_phone").value.trim(),
      logo_base64: logo.base64,
      logo_name: logo.name
    });
    $("logoFile").value = "";
    $("settingsMessage").textContent = "Restaurant details saved.";
    $("settingsMessage").className = "success";
    renderAll();
  } catch (error) {
    $("settingsMessage").textContent = error.message;
    $("settingsMessage").className = "error";
  }
}

function renderCategories() {
  const box = $("categoryList");
  box.innerHTML = "";

  state.categories.forEach(category => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(category.name)}</strong>
        <div class="meta">
          <span class="type-pill">${escapeHtml(category.food_type)}</span>
          Order ${category.sort_order} · ${category.active ? "Active" : "Hidden"}
        </div>
      </div>
      <div>
        <button class="secondary" type="button" onclick="editCategory(${category.id})">Edit</button>
        <button class="danger" type="button" onclick="deleteCategory(${category.id})">Delete</button>
      </div>
    `;
    box.appendChild(row);
  });
}

function renderCategoryOptions() {
  const select = $("itemCategory");
  const current = select.value;
  select.innerHTML = "";

  state.categories
    .filter(c => c.active)
    .forEach(category => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = `[${category.food_type}] ${category.name}`;
      select.appendChild(option);
    });

  if ([...select.options].some(o => o.value === current)) {
    select.value = current;
  }
}

function editCategory(id) {
  const category = state.categories.find(c => Number(c.id) === Number(id));
  if (!category) return;

  $("categoryId").value = category.id;
  $("categoryFoodType").value = category.food_type;
  $("categoryName").value = category.name;
  $("categoryOrder").value = category.sort_order;
  $("categoryActive").checked = !!category.active;
  $("cancelCategory").classList.remove("hidden");
}

function resetCategoryForm() {
  $("categoryId").value = "";
  $("categoryFoodType").value = "VEG";
  $("categoryName").value = "";
  $("categoryOrder").value = Math.max(1, state.categories.length + 1);
  $("categoryActive").checked = true;
  $("cancelCategory").classList.add("hidden");
}

async function saveCategory(event) {
  event.preventDefault();

  try {
    state = await api("save_category", {
      id: $("categoryId").value,
      food_type: $("categoryFoodType").value,
      name: $("categoryName").value.trim(),
      sort_order: $("categoryOrder").value,
      active: $("categoryActive").checked ? "TRUE" : "FALSE"
    });
    resetCategoryForm();
    renderAll();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteCategory(id) {
  if (!confirm("Delete this category? Move/delete its menu items first.")) return;

  try {
    state = await api("delete_category", { id });
    renderAll();
  } catch (error) {
    alert(error.message);
  }
}

function renderItems() {
  const box = $("itemList");
  box.innerHTML = "";

  state.menu
    .filter(item => itemFilter === "ALL" || item.food_type === itemFilter)
    .forEach(item => {
      const category = state.categories.find(c => Number(c.id) === Number(item.category_id));
      const row = document.createElement("div");
      row.className = "list-row";

      const photo = item.image_url
        ? `<img class="thumb" src="${driveImageUrl(item.image_url)}" alt="">`
        : `<div class="thumb"></div>`;

      row.innerHTML = `
        <div class="list-main">
          ${photo}
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <div class="meta">
              <span class="type-pill">${escapeHtml(item.food_type)}</span>
              ${escapeHtml(category ? category.name : "Unknown")} · ₹${Number(item.price || 0).toFixed(0)}
              · ${item.available ? "Available" : "Unavailable"}
              ${item.badge ? ` · ${escapeHtml(item.badge)}` : ""}
            </div>
          </div>
        </div>
        <div>
          <button class="secondary" type="button" onclick="editItem(${item.id})">Edit</button>
          <button class="danger" type="button" onclick="deleteItem(${item.id})">Delete</button>
        </div>
      `;
      box.appendChild(row);
    });
}

function editItem(id) {
  const item = state.menu.find(x => Number(x.id) === Number(id));
  if (!item) return;

  $("itemId").value = item.id;
  $("itemCategory").value = item.category_id;
  $("itemName").value = item.name;
  $("itemDescription").value = item.description || "";
  $("itemPrice").value = item.price;
  $("itemBadge").value = item.badge || "";
  $("itemOrder").value = item.sort_order;
  $("itemAvailable").checked = !!item.available;
  $("itemPhoto").value = "";
  $("cancelItem").classList.remove("hidden");
}

function resetItemForm() {
  $("itemId").value = "";
  $("itemName").value = "";
  $("itemDescription").value = "";
  $("itemPrice").value = "";
  $("itemBadge").value = "";
  $("itemOrder").value = 1;
  $("itemAvailable").checked = true;
  $("itemPhoto").value = "";
  $("cancelItem").classList.add("hidden");
}

async function saveItem(event) {
  event.preventDefault();
  $("itemMessage").textContent = "Saving...";
  $("itemMessage").className = "";

  try {
    const image = await getFilePayload("itemPhoto");
    state = await api("save_item", {
      id: $("itemId").value,
      category_id: $("itemCategory").value,
      name: $("itemName").value.trim(),
      description: $("itemDescription").value.trim(),
      price: $("itemPrice").value,
      badge: $("itemBadge").value.trim(),
      sort_order: $("itemOrder").value,
      available: $("itemAvailable").checked ? "TRUE" : "FALSE",
      image_base64: image.base64,
      image_name: image.name
    });
    $("itemMessage").textContent = "Item saved.";
    $("itemMessage").className = "success";
    resetItemForm();
    renderAll();
  } catch (error) {
    $("itemMessage").textContent = error.message;
    $("itemMessage").className = "error";
  }
}

async function deleteItem(id) {
  if (!confirm("Delete this menu item?")) return;

  try {
    state = await api("delete_item", { id });
    renderAll();
  } catch (error) {
    alert(error.message);
  }
}

function logout() {
  adminPassword = "";
  state = null;
  $("dashboard").classList.add("hidden");
  $("loginCard").classList.remove("hidden");
  $("password").value = "";
}

$("loginBtn").addEventListener("click", login);
$("password").addEventListener("keydown", e => {
  if (e.key === "Enter") login();
});
$("logoutBtn").addEventListener("click", logout);
$("saveSettingsBtn").addEventListener("click", saveSettings);
$("categoryForm").addEventListener("submit", saveCategory);
$("cancelCategory").addEventListener("click", resetCategoryForm);
$("itemForm").addEventListener("submit", saveItem);
$("cancelItem").addEventListener("click", resetItemForm);

document.querySelectorAll(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    itemFilter = button.dataset.filter;
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    renderItems();
  });
});
