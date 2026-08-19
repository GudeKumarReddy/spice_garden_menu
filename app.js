const state = {
  data: null,
  activeType: "VEG",
  search: ""
};

const el = id => document.getElementById(id);

function normalizePhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function whatsappNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  return digits;
}

function driveImageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  const idMatch =
    value.match(/\/d\/([^/]+)/) ||
    value.match(/[?&]id=([^&]+)/) ||
    value.match(/\/file\/d\/([^/]+)/);

  if (idMatch) {
    return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
  }

  return value;
}

function setText(id, value) {
  const node = el(id);
  if (node) node.textContent = value || "";
}

function renderRestaurant(settings) {
  const name = settings.restaurant_name || "Restaurant";
  setText("restaurantName", name);
  setText("restaurantDescription", settings.description || "");
  setText("restaurantAddress", settings.address ? `📍 ${settings.address}` : "");
  setText("workingHours", settings.working_hours ? `🕒 ${settings.working_hours}` : "");
  setText("footerRestaurantName", name);
  setText("footerPhone", settings.phone || "");

  document.title = `${name} - Menu`;

  const logo = el("restaurantLogo");
  logo.src = settings.logo_url ? driveImageUrl(settings.logo_url) : "logo.svg";
  logo.onerror = () => {
    if (!logo.src.endsWith("logo.svg")) logo.src = "logo.svg";
  };

  const phone = normalizePhone(settings.phone);
  const callBtn = el("callButton");
  callBtn.href = phone ? `tel:${phone}` : "#";
  callBtn.classList.toggle("hidden", !phone);

  const wa = whatsappNumber(settings.whatsapp || settings.phone);
  const waBtn = el("whatsappButton");
  waBtn.href = wa ? `https://wa.me/${wa}` : "#";
  waBtn.classList.toggle("hidden", !wa);

  const emailBtn = el("emailButton");
  if (settings.email) {
    emailBtn.href = `mailto:${settings.email}`;
    emailBtn.classList.remove("hidden");
  } else {
    emailBtn.classList.add("hidden");
  }

  const devName = settings.developer_name || "UV Web Creations";
  const devPhone = settings.developer_phone || "9392417891";
  setText("developerName", devName);
  setText("developerPhone", devPhone);
  el("developerPhone").href = `tel:${normalizePhone(devPhone)}`;
}

function visibleCategories() {
  if (!state.data) return [];
  return state.data.categories
    .filter(c => c.active && (c.food_type === state.activeType || c.food_type === "SHARED"))
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
}

function visibleItems() {
  if (!state.data) return [];
  const query = state.search.trim().toLowerCase();

  return state.data.menu
    .filter(item => item.available)
    .filter(item => item.food_type === state.activeType || item.food_type === "SHARED")
    .filter(item => {
      if (!query) return true;
      return [item.name, item.description, item.badge]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
}

function renderCategoryNav() {
  const nav = el("categoryNav");
  nav.innerHTML = "";

  visibleCategories().forEach(category => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "category-chip" + (category.food_type === "SHARED" ? " shared" : "");
    btn.textContent = category.food_type === "SHARED" ? `🥤 ${category.name}` : category.name;
    btn.addEventListener("click", () => {
      el(`category-${category.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    nav.appendChild(btn);
  });
}

function createFoodMark(type) {
  const mark = document.createElement("span");
  mark.className =
    "food-mark " +
    (type === "VEG" ? "veg" : type === "NONVEG" ? "nonveg" : "shared");
  mark.setAttribute("aria-hidden", "true");
  return mark;
}

function createMenuCard(item) {
  const card = document.createElement("article");
  card.className = "menu-card";

  const photoWrap = document.createElement("div");
  photoWrap.className = "item-photo-wrap";

  if (item.image_url) {
    const img = document.createElement("img");
    img.className = "item-photo";
    img.loading = "lazy";
    img.alt = item.name;
    img.src = driveImageUrl(item.image_url);
    img.onerror = () => {
      photoWrap.innerHTML = `<div class="photo-placeholder">🍽️</div>`;
    };
    photoWrap.appendChild(img);
  } else {
    photoWrap.innerHTML = `<div class="photo-placeholder">🍽️</div>`;
  }

  const content = document.createElement("div");
  content.className = "item-content";

  const top = document.createElement("div");
  top.className = "item-topline";
  top.appendChild(createFoodMark(item.food_type));

  const name = document.createElement("div");
  name.className = "item-name";
  name.textContent = item.name;
  top.appendChild(name);

  if (item.badge) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = item.badge;
    top.appendChild(badge);
  }

  const description = document.createElement("p");
  description.className = "item-description";
  description.textContent = item.description || "";

  const price = document.createElement("div");
  price.className = "item-price";
  price.textContent = `₹${Number(item.price || 0).toFixed(0)}`;

  content.append(top, description, price);
  card.append(photoWrap, content);
  return card;
}

function renderMenu() {
  const container = el("menuContainer");
  container.innerHTML = "";

  const categories = visibleCategories();
  const items = visibleItems();
  let rendered = 0;

  categories.forEach(category => {
    const categoryItems = items
      .filter(item => Number(item.category_id) === Number(category.id))
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));

    if (!categoryItems.length) return;

    const section = document.createElement("section");
    section.className = "category-section";
    section.id = `category-${category.id}`;

    const heading = document.createElement("div");
    heading.className = "section-heading";

    const h2 = document.createElement("h2");
    h2.textContent = category.name;

    const count = document.createElement("span");
    count.textContent = `${categoryItems.length} item${categoryItems.length === 1 ? "" : "s"}`;

    heading.append(h2, count);

    const grid = document.createElement("div");
    grid.className = "items-grid";

    categoryItems.forEach(item => {
      grid.appendChild(createMenuCard(item));
      rendered++;
    });

    section.append(heading, grid);
    container.appendChild(section);
  });

  el("emptyState").classList.toggle("hidden", rendered > 0);
}

function renderAll() {
  document.querySelectorAll(".food-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.type === state.activeType);
  });
  renderCategoryNav();
  renderMenu();
}

async function loadMenu() {
  try {
    if (!API_URL || API_URL.includes("PASTE_YOUR")) {
      throw new Error("Add your Google Apps Script Web App URL in config.js.");
    }

    const response = await fetch(`${API_URL}?action=menu&_=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) throw new Error("Unable to connect to the menu backend.");

    const result = await response.json();
    if (!result.success) throw new Error(result.error || "Unable to load menu.");

    state.data = result.data;
    renderRestaurant(result.data.restaurant || {});
    renderAll();

    el("loading").classList.add("hidden");
  } catch (error) {
    console.error(error);
    el("loading").classList.add("hidden");
    const box = el("error");
    box.textContent = error.message || "Unable to load menu.";
    box.classList.remove("hidden");
  }
}

document.querySelectorAll(".food-tab").forEach(button => {
  button.addEventListener("click", () => {
    state.activeType = button.dataset.type;
    state.search = "";
    el("searchInput").value = "";
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

el("searchInput").addEventListener("input", event => {
  state.search = event.target.value;
  renderMenu();
});

loadMenu();
