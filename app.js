const state = {
  data: null,
  type: "VEG",
  query: ""
};

const byId = id => document.getElementById(id);

function cleanPhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function whatsappPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}

function driveImage(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  const match =
    value.match(/\/d\/([^/]+)/) ||
    value.match(/[?&]id=([^&]+)/);

  return match
    ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`
    : value;
}

function renderRestaurant(s) {
  const name = s.restaurant_name || "Spice Garden";
  byId("restaurantName").textContent = name;
  byId("restaurantDescription").textContent =
    s.description || "Fresh flavours. Warm hospitality.";
  byId("restaurantAddress").textContent =
    s.address ? `📍 ${s.address}` : "";
  byId("restaurantPhone").textContent =
    s.phone ? `☎ ${s.phone}` : "";
  byId("restaurantHours").textContent =
    s.working_hours ? `🕒 ${s.working_hours}` : "";

  document.title = `${name} | Menu`;

  const logo = byId("restaurantLogo");
  logo.src = s.logo_url ? driveImage(s.logo_url) : "spice-garden-logo.svg";
  logo.onerror = () => {
    logo.src = "spice-garden-logo.svg";
  };

  const phone = cleanPhone(s.phone);
  const call = byId("callLink");
  call.href = phone ? `tel:${phone}` : "#";
  call.classList.toggle("hidden", !phone);

  const wa = whatsappPhone(s.whatsapp || s.phone);
  const whatsapp = byId("whatsappLink");
  whatsapp.href = wa ? `https://wa.me/${wa}` : "#";
  whatsapp.classList.toggle("hidden", !wa);
}

function activeCategories() {
  if (!state.data) return [];
  return state.data.categories
    .filter(c => c.active)
    .filter(c => c.food_type === state.type || c.food_type === "SHARED")
    .sort((a,b) => Number(a.sort_order) - Number(b.sort_order));
}

function activeItems() {
  if (!state.data) return [];
  const q = state.query.trim().toLowerCase();

  return state.data.menu
    .filter(i => i.available)
    .filter(i => i.food_type === state.type || i.food_type === "SHARED")
    .filter(i => {
      if (!q) return true;
      return `${i.name} ${i.description} ${i.badge}`
        .toLowerCase()
        .includes(q);
    });
}

function renderNav() {
  const nav = byId("categoryNav");
  nav.innerHTML = "";

  activeCategories().forEach(category => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "category-chip" + (category.food_type === "SHARED" ? " shared" : "");
    button.textContent =
      category.food_type === "SHARED" ? `🥤 ${category.name}` : category.name;

    button.onclick = () => {
      byId(`category-${category.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    nav.appendChild(button);
  });
}

function mark(type) {
  const m = document.createElement("span");
  m.className =
    "food-mark " +
    (type === "VEG" ? "veg" : type === "NONVEG" ? "nonveg" : "shared");
  return m;
}

function card(item) {
  const root = document.createElement("article");
  root.className = "menu-card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "image-wrap";

  if (item.image_url) {
    const img = document.createElement("img");
    img.className = "food-image";
    img.loading = "lazy";
    img.alt = item.name;
    img.src = driveImage(item.image_url);
    img.onerror = () => {
      imageWrap.innerHTML = '<div class="image-placeholder">🍽️</div>';
    };
    imageWrap.appendChild(img);
  } else {
    imageWrap.innerHTML = '<div class="image-placeholder">🍽️</div>';
  }

  const body = document.createElement("div");
  body.className = "item-body";

  const titleRow = document.createElement("div");
  titleRow.className = "item-title-row";
  titleRow.appendChild(mark(item.food_type));

  const name = document.createElement("div");
  name.className = "item-name";
  name.textContent = item.name;
  titleRow.appendChild(name);

  if (item.badge) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = item.badge;
    titleRow.appendChild(badge);
  }

  const desc = document.createElement("p");
  desc.className = "item-description";
  desc.textContent = item.description || "";

  const price = document.createElement("div");
  price.className = "item-price";
  price.textContent = `₹${Number(item.price || 0).toFixed(0)}`;

  body.append(titleRow, desc, price);
  root.append(imageWrap, body);
  return root;
}

function renderMenu() {
  const container = byId("menuContainer");
  container.innerHTML = "";

  const categories = activeCategories();
  const items = activeItems();
  let shown = 0;

  categories.forEach(category => {
    const rows = items
      .filter(item => Number(item.category_id) === Number(category.id))
      .sort((a,b) => Number(a.sort_order) - Number(b.sort_order));

    if (!rows.length) return;

    const section = document.createElement("section");
    section.className = "category-section";
    section.id = `category-${category.id}`;

    const head = document.createElement("div");
    head.className = "section-head";

    const h2 = document.createElement("h2");
    h2.textContent = category.name;

    const count = document.createElement("span");
    count.textContent = `${rows.length} item${rows.length === 1 ? "" : "s"}`;

    head.append(h2, count);

    const grid = document.createElement("div");
    grid.className = "items-grid";

    rows.forEach(item => {
      grid.appendChild(card(item));
      shown++;
    });

    section.append(head, grid);
    container.appendChild(section);
  });

  byId("empty").classList.toggle("hidden", shown !== 0);
}

function renderAll() {
  document.querySelectorAll(".food-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.type === state.type);
  });

  renderNav();
  renderMenu();
}

async function load() {
  try {
    if (!API_URL || API_URL.includes("PASTE_SPICE_GARDEN")) {
      throw new Error("Add your Apps Script Web App URL inside config.js.");
    }

    const response = await fetch(`${API_URL}?action=menu&_=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Unable to connect to Spice Garden menu backend.");
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "Unable to load menu.");
    }

    state.data = result.data;
    renderRestaurant(result.data.restaurant || {});
    renderAll();

    byId("loading").classList.add("hidden");
  } catch (error) {
    console.error(error);
    byId("loading").classList.add("hidden");
    byId("error").textContent = error.message;
    byId("error").classList.remove("hidden");
  }
}

document.querySelectorAll(".food-tab").forEach(button => {
  button.addEventListener("click", () => {
    state.type = button.dataset.type;
    state.query = "";
    byId("searchInput").value = "";
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

byId("searchInput").addEventListener("input", event => {
  state.query = event.target.value;
  renderMenu();
});

load();
