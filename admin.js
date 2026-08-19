let adminPassword = "";
let dataState = null;
let filterType = "ALL";

const $ = id => document.getElementById(id);

function driveImage(url) {
  const value = String(url || "");
  const match =
    value.match(/\/d\/([^/]+)/) ||
    value.match(/[?&]id=([^&]+)/);
  return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w500` : value;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

async function api(action, payload = {}) {
  if (!API_URL || API_URL.includes("PASTE_SPICE_GARDEN")) {
    throw new Error("Add your Apps Script URL in config.js.");
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

  if (!response.ok) throw new Error("Backend request failed.");

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || "Request failed.");
  }

  return result.data;
}

function fileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function imagePayload(inputId) {
  const file = $(inputId).files[0];

  if (!file) {
    return { base64: "", name: "" };
  }

  if (file.size > 3 * 1024 * 1024) {
    throw new Error("Photo must be 3 MB or smaller. Recommended: 1200×900 JPG under 500 KB.");
  }

  return {
    base64: await fileBase64(file),
    name: file.name
  };
}

async function login() {
  adminPassword = $("password").value;
  $("loginMessage").textContent = "";

  try {
    dataState = await api("admin_data");
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
  renderCategorySelect();
  renderItems();
}

function renderSettings() {
  const s = dataState.restaurant || {};

  [
    "restaurant_name", "phone", "whatsapp", "email",
    "address", "description", "working_hours"
  ].forEach(key => {
    $(key).value = s[key] || "";
  });
}

async function saveSettings() {
  $("settingsMessage").textContent = "Saving...";
  $("settingsMessage").className = "";

  try {
    const logo = await imagePayload("logoFile");

    dataState = await api("save_settings", {
      restaurant_name: $("restaurant_name").value.trim(),
      phone: $("phone").value.trim(),
      whatsapp: $("whatsapp").value.trim(),
      email: $("email").value.trim(),
      address: $("address").value.trim(),
      description: $("description").value.trim(),
      working_hours: $("working_hours").value.trim(),
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

  dataState.categories.forEach(category => {
    const row = document.createElement("div");
    row.className = "row";

    row.innerHTML = `
      <div>
        <strong>${escapeHtml(category.name)}</strong>
        <div class="meta">
          <span class="pill">${escapeHtml(category.food_type)}</span>
          Order ${category.sort_order} · ${category.active ? "Active" : "Hidden"}
        </div>
      </div>
      <div>
        <button class="secondary" onclick="editCategory(${category.id})">Edit</button>
        <button class="danger" onclick="deleteCategory(${category.id})">Delete</button>
      </div>
    `;

    box.appendChild(row);
  });
}

function renderCategorySelect() {
  const select = $("itemCategory");
  const existing = select.value;

  select.innerHTML = "";

  dataState.categories
    .filter(c => c.active)
    .forEach(category => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = `[${category.food_type}] ${category.name}`;
      select.appendChild(option);
    });

  if ([...select.options].some(o => o.value === existing)) {
    select.value = existing;
  }
}

function editCategory(id) {
  const c = dataState.categories.find(x => Number(x.id) === Number(id));
  if (!c) return;

  $("categoryId").value = c.id;
  $("categoryFoodType").value = c.food_type;
  $("categoryName").value = c.name;
  $("categoryOrder").value = c.sort_order;
  $("categoryActive").checked = c.active;
  $("cancelCategory").classList.remove("hidden");
}

function resetCategory() {
  $("categoryId").value = "";
  $("categoryFoodType").value = "VEG";
  $("categoryName").value = "";
  $("categoryOrder").value = 1;
  $("categoryActive").checked = true;
  $("cancelCategory").classList.add("hidden");
}

async function saveCategory(event) {
  event.preventDefault();

  try {
    dataState = await api("save_category", {
      id: $("categoryId").value,
      food_type: $("categoryFoodType").value,
      name: $("categoryName").value.trim(),
      sort_order: $("categoryOrder").value,
      active: $("categoryActive").checked ? "TRUE" : "FALSE"
    });

    resetCategory();
    renderAll();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteCategory(id) {
  if (!confirm("Delete this category? Move or delete its menu items first.")) return;

  try {
    dataState = await api("delete_category", { id });
    renderAll();
  } catch (error) {
    alert(error.message);
  }
}

function renderItems() {
  const box = $("itemList");
  box.innerHTML = "";

  dataState.menu
    .filter(item => filterType === "ALL" || item.food_type === filterType)
    .forEach(item => {
      const category =
        dataState.categories.find(c => Number(c.id) === Number(item.category_id));

      const row = document.createElement("div");
      row.className = "row";

      const photo = item.image_url
        ? `<img class="thumb" src="${driveImage(item.image_url)}" alt="">`
        : `<div class="thumb"></div>`;

      row.innerHTML = `
        <div class="row-main">
          ${photo}
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <div class="meta">
              <span class="pill">${escapeHtml(item.food_type)}</span>
              ${escapeHtml(category ? category.name : "Unknown")} ·
              ₹${Number(item.price || 0).toFixed(0)} ·
              ${item.available ? "Available" : "Unavailable"}
              ${item.badge ? ` · ${escapeHtml(item.badge)}` : ""}
            </div>
          </div>
        </div>
        <div>
          <button class="secondary" onclick="editItem(${item.id})">Edit</button>
          <button class="danger" onclick="deleteItem(${item.id})">Delete</button>
        </div>
      `;

      box.appendChild(row);
    });
}

function editItem(id) {
  const item = dataState.menu.find(x => Number(x.id) === Number(id));
  if (!item) return;

  $("itemId").value = item.id;
  $("itemCategory").value = item.category_id;
  $("itemName").value = item.name;
  $("itemDescription").value = item.description || "";
  $("itemPrice").value = item.price;
  $("itemBadge").value = item.badge || "";
  $("itemOrder").value = item.sort_order;
  $("itemAvailable").checked = item.available;
  $("itemPhoto").value = "";

  const currentBox = $("currentPhotoBox");
  const currentPreview = $("currentPhotoPreview");

  if (item.image_url) {
    currentPreview.src = driveImage(item.image_url);
    currentBox.classList.remove("hidden");
  } else {
    currentPreview.removeAttribute("src");
    currentBox.classList.add("hidden");
  }

  $("cancelItem").classList.remove("hidden");

  $("itemForm").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function resetItem() {
  $("itemId").value = "";
  $("itemName").value = "";
  $("itemDescription").value = "";
  $("itemPrice").value = "";
  $("itemBadge").value = "";
  $("itemOrder").value = 1;
  $("itemAvailable").checked = true;
  $("itemPhoto").value = "";
  $("currentPhotoPreview").removeAttribute("src");
  $("currentPhotoBox").classList.add("hidden");
  $("cancelItem").classList.add("hidden");
}

async function saveItem(event) {
  event.preventDefault();
  $("itemMessage").textContent = "Saving...";
  $("itemMessage").className = "";

  try {
    const image = await imagePayload("itemPhoto");

    dataState = await api("save_item", {
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
    resetItem();
    renderAll();
  } catch (error) {
    $("itemMessage").textContent = error.message;
    $("itemMessage").className = "error";
  }
}

async function deleteItem(id) {
  if (!confirm("Delete this menu item?")) return;

  try {
    dataState = await api("delete_item", { id });
    renderAll();
  } catch (error) {
    alert(error.message);
  }
}

function logout() {
  adminPassword = "";
  dataState = null;
  $("dashboard").classList.add("hidden");
  $("loginCard").classList.remove("hidden");
  $("password").value = "";
}

$("loginBtn").onclick = login;
$("password").addEventListener("keydown", event => {
  if (event.key === "Enter") login();
});
$("logoutBtn").onclick = logout;
$("saveSettingsBtn").onclick = saveSettings;
$("categoryForm").onsubmit = saveCategory;
$("cancelCategory").onclick = resetCategory;
$("itemForm").onsubmit = saveItem;
$("cancelItem").onclick = resetItem;

document.querySelectorAll(".filter").forEach(button => {
  button.onclick = () => {
    filterType = button.dataset.filter;
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    renderItems();
  };
});
