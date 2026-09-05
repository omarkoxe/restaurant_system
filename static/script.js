// ==========================================
// LANGUAGE
// ==========================================

let currentLanguage =
    localStorage.getItem("language") || "ar";


function applyLanguage() {

    document.querySelectorAll("[data-ar]").forEach(element => {

        if (currentLanguage === "ku") {
            element.textContent =
                element.dataset.ku;
        } else {
            element.textContent =
                element.dataset.ar;
        }

    });

    document.documentElement.lang =
        currentLanguage === "ku" ? "ku" : "ar";

    document.documentElement.dir = "rtl";
}


function toggleLanguage() {

    currentLanguage =
        currentLanguage === "ar" ? "ku" : "ar";

    localStorage.setItem(
        "language",
        currentLanguage
    );

    applyLanguage();

    if (typeof renderFoods === "function") {
        renderFoods();
    }

    if (typeof renderCart === "function") {
        renderCart();
    }

    if (typeof renderAdminFoods === "function") {
        renderAdminFoods();
    }

    if (typeof loadOrders === "function") {
        loadOrders();
    }
}


// ==========================================
// CUSTOMER MENU
// ==========================================

let foods = [];
let cart = [];


async function loadFoods() {

    const response =
        await fetch("/api/foods");

    foods = await response.json();

    renderFoods();
}


function renderFoods() {

    const container =
        document.getElementById("foodContainer");

    if (!container) {
        return;
    }

    const searchInput =
        document.getElementById("searchInput");

    const search =
        searchInput
            ? searchInput.value.toLowerCase()
            : "";

    const availableFoods =
        foods.filter(food => {

            const name =
                currentLanguage === "ku"
                    ? food.name_ku
                    : food.name_ar;

            return (
                food.available === 1 &&
                name.toLowerCase().includes(search)
            );
        });


    if (availableFoods.length === 0) {

        container.innerHTML = `
            <div class="empty-box">
                لا توجد أكلات حالياً
            </div>
        `;

        return;
    }


    container.innerHTML =
        availableFoods.map(food => {

            const name =
                currentLanguage === "ku"
                    ? food.name_ku
                    : food.name_ar;

            const image =
                food.image_url
                    ? `<img src="${escapeHtml(food.image_url)}"
                            alt="${escapeHtml(name)}">`
                    : `<div class="food-placeholder">🍽️</div>`;


            return `
                <div class="food-card">

                    <div class="food-image">
                        ${image}
                    </div>

                    <h3>
                        ${escapeHtml(name)}
                    </h3>

                    <p class="food-price">
                        ${food.price.toLocaleString()} IQD
                    </p>

                    <button
                        onclick="addToCart(${food.id})">

                        ${
                            currentLanguage === "ku"
                                ? "زێدەبکە بۆ سەبەتێ"
                                : "أضف إلى السلة"
                        }

                    </button>

                </div>
            `;

        }).join("");
}


// ==========================================
// CART
// ==========================================

function addToCart(foodId) {

    const existing =
        cart.find(item =>
            item.food_id === foodId
        );

    if (existing) {

        existing.quantity++;

    } else {

        cart.push({
            food_id: foodId,
            quantity: 1
        });

    }

    renderCart();
}


function increaseQuantity(foodId) {

    const item =
        cart.find(item =>
            item.food_id === foodId
        );

    if (item) {
        item.quantity++;
    }

    renderCart();
}


function decreaseQuantity(foodId) {

    const item =
        cart.find(item =>
            item.food_id === foodId
        );

    if (!item) {
        return;
    }

    item.quantity--;

    if (item.quantity <= 0) {

        cart =
            cart.filter(item =>
                item.food_id !== foodId
            );

    }

    renderCart();
}


function removeFromCart(foodId) {

    cart =
        cart.filter(item =>
            item.food_id !== foodId
        );

    renderCart();
}


function renderCart() {

    const container =
        document.getElementById("cartContainer");

    const totalElement =
        document.getElementById("cartTotal");

    if (!container || !totalElement) {
        return;
    }


    if (cart.length === 0) {

        container.innerHTML = `
            <div class="empty-box">
                ${
                    currentLanguage === "ku"
                        ? "سەبەتە بەتاڵە"
                        : "السلة فارغة"
                }
            </div>
        `;

        totalElement.textContent = "0";

        return;
    }


    let total = 0;


    container.innerHTML =
        cart.map(item => {

            const food =
                foods.find(f =>
                    f.id === item.food_id
                );

            if (!food) {
                return "";
            }

            const name =
                currentLanguage === "ku"
                    ? food.name_ku
                    : food.name_ar;

            const itemTotal =
                food.price * item.quantity;

            total += itemTotal;


            return `
                <div class="cart-item">

                    <div>
                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <div>
                            ${food.price.toLocaleString()} IQD
                        </div>
                    </div>


                    <div class="quantity-control">

                        <button
                            onclick="decreaseQuantity(${food.id})">
                            −
                        </button>

                        <span>
                            ${item.quantity}
                        </span>

                        <button
                            onclick="increaseQuantity(${food.id})">
                            +
                        </button>

                    </div>


                    <strong>
                        ${itemTotal.toLocaleString()} IQD
                    </strong>


                    <button
                        class="remove-btn"
                        onclick="removeFromCart(${food.id})">
                        🗑️
                    </button>

                </div>
            `;

        }).join("");


    totalElement.textContent =
        total.toLocaleString();
}


function clearCart() {

    cart = [];

    renderCart();
}


// ==========================================
// SEND ORDER
// ==========================================

async function sendOrder() {

    if (cart.length === 0) {

        alert(
            currentLanguage === "ku"
                ? "سەبەتە بەتاڵە"
                : "السلة فارغة"
        );

        return;
    }


    const customerName =
        document.getElementById("customerName")?.value || "";

    const phone =
        document.getElementById("phone")?.value || "";

    const address =
        document.getElementById("address")?.value || "";

    const notes =
        document.getElementById("notes")?.value || "";


    const response =
        await fetch("/api/orders", {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                customer_name: customerName,
                phone: phone,
                address: address,
                notes: notes,
                items: cart
            })

        });


    const result =
        await response.json();


    if (!result.success) {

        alert(result.message);

        return;
    }


    alert(
        `${
            currentLanguage === "ku"
                ? "داخوازی هاتە فرێکرن"
                : "تم إرسال الطلب"
        }\n\n#${result.order_id}`
    );


    cart = [];

    renderCart();


    document.getElementById("customerName").value = "";
    document.getElementById("phone").value = "";
    document.getElementById("address").value = "";
    document.getElementById("notes").value = "";
}


// ==========================================
// ADMIN LOGIN
// ==========================================

async function loginAdmin() {

    const username =
        document.getElementById("username").value;

    const password =
        document.getElementById("password").value;


    const response =
        await fetch("/api/login", {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                username,
                password
            })

        });


    const result =
        await response.json();


    const message =
        document.getElementById("loginMessage");


    if (!result.success) {

        message.textContent =
            result.message;

        return;
    }


    window.location.href =
        "/admin";
}


async function logoutAdmin() {

    await fetch(
        "/api/logout",
        { method: "POST" }
    );

    window.location.href =
        "/login";
}


// ==========================================
// ADMIN FOODS
// ==========================================

let adminFoods = [];
let categories = [];


async function loadAdminData() {

    const foodsResponse =
        await fetch("/api/foods");

    adminFoods =
        await foodsResponse.json();


    const categoriesResponse =
        await fetch("/api/categories");

    categories =
        await categoriesResponse.json();


    renderAdminFoods();
    renderCategorySelect();
}


function renderAdminFoods() {

    const container =
        document.getElementById("adminFoods");

    if (!container) {
        return;
    }


    container.innerHTML =
        adminFoods.map(food => {

            const name =
                currentLanguage === "ku"
                    ? food.name_ku
                    : food.name_ar;


            return `
                <div class="admin-food-row">

                    <div class="admin-food-info">

                        <div class="small-food-image">

                            ${
                                food.image_url
                                    ? `<img src="${escapeHtml(food.image_url)}">`
                                    : "🍽️"
                            }

                        </div>

                        <div>

                            <strong>
                                ${escapeHtml(name)}
                            </strong>

                            <p>
                                ${food.price.toLocaleString()} IQD
                            </p>

                        </div>

                    </div>


                    <div class="admin-food-actions">

                        <button
                            onclick="editFood(${food.id})">
                            ✏️
                            ${
                                currentLanguage === "ku"
                                    ? "راستڤەکرن"
                                    : "تعديل"
                            }
                        </button>


                        <button
                            onclick="toggleFood(${food.id}, ${food.available})">

                            ${
                                food.available
                                    ? "🟢 متوفر"
                                    : "🔴 غير متوفر"
                            }

                        </button>


                        <button
                            class="delete-btn"
                            onclick="deleteFood(${food.id})">

                            🗑️
                            ${
                                currentLanguage === "ku"
                                    ? "ژێبرن"
                                    : "حذف"
                            }

                        </button>

                    </div>

                </div>
            `;

        }).join("");
}


function renderCategorySelect() {

    const select =
        document.getElementById("foodCategory");

    if (!select) {
        return;
    }


    select.innerHTML =
        categories.map(category => {

            const name =
                currentLanguage === "ku"
                    ? category.name_ku
                    : category.name_ar;

            return `
                <option value="${category.id}">
                    ${escapeHtml(name)}
                </option>
            `;

        }).join("");
}


function openFoodForm(food = null) {

    const section =
        document.getElementById("foodFormSection");

    section.classList.remove("hidden");


    if (!food) {

        document.getElementById("foodFormTitle")
            .textContent = "إضافة أكلة";

        document.getElementById("foodId")
            .value = "";

        document.getElementById("foodNameAr")
            .value = "";

        document.getElementById("foodNameKu")
            .value = "";

        document.getElementById("foodPrice")
            .value = "";

        document.getElementById("foodImage")
            .value = "";

        document.getElementById("foodAvailable")
            .checked = true;

    }

}


function closeFoodForm() {

    const section =
        document.getElementById("foodFormSection");

    if (section) {
        section.classList.add("hidden");
    }
}


function editFood(foodId) {

    const food =
        adminFoods.find(f =>
            f.id === foodId
        );

    if (!food) {
        return;
    }


    openFoodForm(food);


    document.getElementById("foodFormTitle")
        .textContent = "تعديل الأكلة";


    document.getElementById("foodId")
        .value = food.id;

    document.getElementById("foodNameAr")
        .value = food.name_ar;

    document.getElementById("foodNameKu")
        .value = food.name_ku;

    document.getElementById("foodPrice")
        .value = food.price;

    document.getElementById("foodImage")
        .value = food.image_url || "";

    document.getElementById("foodCategory")
        .value = food.category_id || "";

    document.getElementById("foodAvailable")
        .checked = food.available === 1;
}


async function saveFood() {

    const id =
        document.getElementById("foodId").value;

    const data = {

        name_ar:
            document.getElementById("foodNameAr").value,

        name_ku:
            document.getElementById("foodNameKu").value,

        price:
            document.getElementById("foodPrice").value,

        image_url:
            document.getElementById("foodImage").value,

        category_id:
            document.getElementById("foodCategory").value,

        available:
            document.getElementById("foodAvailable").checked

    };


    const url =
        id
            ? `/api/foods/${id}`
            : "/api/foods";

    const method =
        id ? "PUT" : "POST";


    const response =
        await fetch(url, {

            method,

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify(data)

        });


    const result =
        await response.json();


    if (!result.success) {

        alert(result.message);

        return;
    }


    alert(
        id
            ? "تم تعديل الأكلة"
            : "تمت إضافة الأكلة"
    );


    closeFoodForm();

    await loadAdminData();

    await loadFoods();
}


async function deleteFood(foodId) {

    if (!confirm("هل أنت متأكد من حذف الأكلة؟")) {
        return;
    }


    const response =
        await fetch(
            `/api/foods/${foodId}`,
            {
                method: "DELETE"
            }
        );


    const result =
        await response.json();


    if (result.success) {

        await loadAdminData();

        await loadFoods();

    } else {

        alert(result.message);

    }
}


async function toggleFood(foodId, currentState) {

    await fetch(
        `/api/foods/${foodId}/availability`,
        {

            method: "PATCH",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                available: !currentState
            })

        }
    );


    await loadAdminData();

    await loadFoods();
}


// ==========================================
// CATEGORIES
// ==========================================

async function addCategory() {

    const nameAr =
        document.getElementById("categoryAr").value;

    const nameKu =
        document.getElementById("categoryKu").value;


    const response =
        await fetch("/api/categories", {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            },

            body: JSON.stringify({
                name_ar: nameAr,
                name_ku: nameKu
            })

        });


    const result =
        await response.json();


    if (!result.success) {

        alert(result.message);

        return;
    }


    document.getElementById("categoryAr").value = "";
    document.getElementById("categoryKu").value = "";


    await loadAdminData();
}


// ==========================================
// PASSWORD
// ==========================================

async function changePassword() {

    const current =
        document.getElementById("currentPassword").value;

    const newPassword =
        document.getElementById("newPassword").value;

    const confirmPassword =
        document.getElementById("confirmPassword").value;


    if (newPassword !== confirmPassword) {

        document.getElementById(
            "passwordMessage"
        ).textContent =
            "كلمتا السر غير متطابقتين";

        return;
    }


    const response =
        await fetch(
            "/api/change-password",
            {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    current_password: current,
                    new_password: newPassword
                })

            }
        );


    const result =
        await response.json();


    document.getElementById(
        "passwordMessage"
    ).textContent =
        result.message;


    if (result.success) {

        document.getElementById(
            "currentPassword"
        ).value = "";

        document.getElementById(
            "newPassword"
        ).value = "";

        document.getElementById(
            "confirmPassword"
        ).value = "";

    }
}


// ==========================================
// REPORTS
// ==========================================

async function loadReports() {

    const response =
        await fetch("/api/reports");


    if (!response.ok) {
        return;
    }


    const data =
        await response.json();


    const totalOrders =
        document.getElementById("totalOrders");

    if (totalOrders) {
        totalOrders.textContent =
            data.total_orders;
    }


    const totalIncome =
        document.getElementById("totalIncome");

    if (totalIncome) {
        totalIncome.textContent =
            data.total_income.toLocaleString()
            + " IQD";
    }


    const todayOrders =
        document.getElementById("todayOrders");

    if (todayOrders) {
        todayOrders.textContent =
            data.today_orders;
    }


    const todayIncome =
        document.getElementById("todayIncome");

    if (todayIncome) {
        todayIncome.textContent =
            data.today_income.toLocaleString()
            + " IQD";
    }


    const bestFoods =
        document.getElementById("bestFoods");


    if (bestFoods) {

        bestFoods.innerHTML =
            data.best_foods.map(food => {

                const name =
                    currentLanguage === "ku"
                        ? food.food_name_ku
                        : food.food_name_ar;

                return `
                    <div class="best-food">
                        <span>
                            ${escapeHtml(name)}
                        </span>

                        <strong>
                            ${food.quantity}
                        </strong>
                    </div>
                `;

            }).join("");

    }
}


// ==========================================
// ORDERS
// ==========================================

async function loadOrders() {

    const container =
        document.getElementById(
            "ordersContainer"
        );

    if (!container) {
        return;
    }


    const response =
        await fetch("/api/orders");


    if (!response.ok) {
        return;
    }


    const orders =
        await response.json();


    if (orders.length === 0) {

        container.innerHTML = `
            <div class="empty-box">
                لا توجد طلبات
            </div>
        `;

        return;
    }


    container.innerHTML =
        orders.map(order => {

            return `
                <div class="order-card">

                    <div class="order-header">

                        <strong>
                            #${order.id}
                        </strong>

                        <span class="status status-${order.status}">
                            ${getStatusText(order.status)}
                        </span>

                    </div>


                    <div class="order-customer">

                        <p>
                            👤 ${escapeHtml(order.customer_name || "-")}
                        </p>

                        <p>
                            📞 ${escapeHtml(order.phone || "-")}
                        </p>

                        <p>
                            📍 ${escapeHtml(order.address || "-")}
                        </p>

                        <p>
                            📝 ${escapeHtml(order.notes || "-")}
                        </p>

                    </div>


                    <div class="order-items">

                        ${
                            order.items.map(item => {

                                const name =
                                    currentLanguage === "ku"
                                        ? item.food_name_ku
                                        : item.food_name_ar;

                                return `
                                    <div class="order-item">

                                        <span>
                                            ${escapeHtml(name)}
                                            ×
                                            ${item.quantity}
                                        </span>

                                        <strong>
                                            ${
                                                (
                                                    item.price *
                                                    item.quantity
                                                ).toLocaleString()
                                            }
                                            IQD
                                        </strong>

                                    </div>
                                `;

                            }).join("")
                        }

                    </div>


                    <div class="order-total">

                        <span
                            data-ar="المجموع الكلي"
                            data-ku="کویێ گشتی">
                            ${
                                currentLanguage === "ku"
                                    ? "کویێ گشتی"
                                    : "المجموع الكلي"
                            }
                        </span>

                        <strong>
                            ${order.total.toLocaleString()} IQD
                        </strong>

                    </div>


                    <div class="order-status-buttons">

                        <button
                            onclick="changeOrderStatus(${order.id}, 'new')">

                            ${
                                currentLanguage === "ku"
                                    ? "داخوازیێن نوو"
                                    : "جديد"
                            }

                        </button>


                        <button
                            onclick="changeOrderStatus(${order.id}, 'preparing')">

                            ${
                                currentLanguage === "ku"
                                    ? "داخوازی ل ژێر ئامادەکرنێیە"
                                    : "قيد التحضير"
                            }

                        </button>


                        <button
                            onclick="changeOrderStatus(${order.id}, 'ready')">

                            ${
                                currentLanguage === "ku"
                                    ? "داخوازی ئامادەیە"
                                    : "جاهز"
                            }

                        </button>


                        <button
                            onclick="changeOrderStatus(${order.id}, 'delivered')">

                            ${
                                currentLanguage === "ku"
                                    ? "داخوازی هاتە وەرگرتن"
                                    : "تم التسليم"
                            }

                        </button>


                        <button
                            class="delete-btn"
                            onclick="changeOrderStatus(${order.id}, 'cancelled')">

                            ${
                                currentLanguage === "ku"
                                    ? "هەڵوەشاندنا داخوازیێ"
                                    : "إلغاء"
                            }

                        </button>

                    </div>

                </div>
            `;

        }).join("");
}


function getStatusText(status) {

    const statuses = {

        new: {
            ar: "جديد",
            ku: "داخوازیێن نوو"
        },

        preparing: {
            ar: "قيد التحضير",
            ku: "داخوازی ل ژێر ئامادەکرنێیە"
        },

        ready: {
            ar: "جاهز",
            ku: "داخوازی ئامادەیە"
        },

        delivered: {
            ar: "تم التسليم",
            ku: "داخوازی هاتە وەرگرتن"
        },

        cancelled: {
            ar: "ملغي",
            ku: "هەڵوەشاندنا داخوازیێ"
        }

    };


    return statuses[status]
        ? statuses[status][currentLanguage]
        : status;
}


async function changeOrderStatus(
    orderId,
    status
) {

    const response =
        await fetch(
            `/api/orders/${orderId}/status`,
            {

                method: "PATCH",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    status
                })

            }
        );


    const result =
        await response.json();


    if (result.success) {
        await loadOrders();
        await loadReports();
    }
}


// ==========================================
// SECURITY HELPER
// ==========================================

function escapeHtml(value) {

    if (value === null ||
        value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ==========================================
// START
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        applyLanguage();


        if (document.getElementById("foodContainer")) {

            await loadFoods();

        }


        if (document.getElementById("adminFoods")) {

            await loadAdminData();

            await loadReports();

        }


        if (document.getElementById("ordersContainer")) {

            await loadOrders();

        }

    }
);