// admin.js
/* Smart Tech Shop — Admin Panel Script */
(function() {
'use strict';
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => Array.from(context.querySelectorAll(selector));
const generateUID = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
const formatCurrencyINR = (amount) => {
if (amount === null || amount === undefined || isNaN(Number(amount))) {
return '₹0';
}
const numericAmount = Number(amount);
return `₹${numericAmount.toLocaleString('en-IN')}`;
};
function isToday(orderDateString) {
const today = new Date();
const orderDate = new Date(orderDateString);
return orderDate.getFullYear() === today.getFullYear() &&
orderDate.getMonth() === today.getMonth() &&
orderDate.getDate() === today.getDate();
}
function matchesDate(orderDateString, targetDateString) {
if (!targetDateString) return true;
const orderDate = new Date(orderDateString);
const orderYMD = orderDate.toISOString().substring(0, 10);
return orderYMD === targetDateString;
}
function getPaymentStatus(order) {
const paymentMethod = order.payment_method;
let isPaid = false;
// FIX: Changed condition to correctly determine 'Paid' status based on server logic (server.js)
if (paymentMethod === 'online' || paymentMethod === 'upi' || paymentMethod === 'Online Pay' || paymentMethod === 'COD - Paid') {
isPaid = true;
} 
return {
text: isPaid ? 'Paid' : 'Not Paid',
class: isPaid ? 'paid' : 'not-paid'
};
}
function showMessage(title, message) {
const existingMessageBox = $('#customMessageBox');
if (existingMessageBox) {
existingMessageBox.remove();
}
const messageBox = document.createElement('div');
messageBox.id = 'customMessageBox';
messageBox.className = 'custom-message-box';
messageBox.innerHTML = `
<h3 class="message-box-title">${title}</h3>
<p class="message-box-text">${message}</p>
<button id="closeMessageBox" class="message-box-btn">OK</button>
`;
document.body.appendChild(messageBox);
const closeBtn = document.getElementById('closeMessageBox');
if (closeBtn) {
closeBtn.addEventListener('click', () => {
messageBox.remove();
});
}
setTimeout(() => {
if (messageBox) {
messageBox.remove();
}
}, 3000);
}
const storage = {
get: (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)),
set: (key, value) => localStorage.setItem(key, JSON.stringify(value))
};
const store = {
orders: () => storage.get('adm_orders', []),
setOrders: value => storage.set('adm_orders', value),
customers: () => storage.get('adm_customers', []),
setCustomers: value => storage.set('adm_customers', value),
};
function setupNavigation() {
$$('.nav-link').forEach(button => {
button.addEventListener('click', () => {
$$('.nav-link').forEach(b => b.classList.remove('active'));
button.classList.add('active');
const targetPageId = button.dataset.target;
$$('.page').forEach(page => page.classList.remove('visible'));
const targetPage = $(`#${targetPageId}`);
if (targetPage) {
targetPage.classList.add('visible');
} else {
console.error(`Error: Page with ID "${targetPageId}" not found.`);
}
window.location.hash = targetPageId;
const sidebar = $('.sidebar');
if (sidebar && window.innerWidth <= 980) {
sidebar.classList.add('hidden-mobile'); 
}
const currentSearchInput = $(`#${targetPageId}Search`);
if (currentSearchInput) {
currentSearchInput.value = '';
}
if (targetPageId === 'productsPage') {
$$('.product-filter-btn').forEach(b => b.classList.remove('active'));
$('.product-filter-btn[data-category="All"]').classList.add('active');
renderProducts('All', '');
} else if (targetPageId === 'ordersPage') {
$$('.order-filter-btn').forEach(b => b.classList.remove('active'));
$('.order-filter-btn[data-status="All"]').classList.add('active');
const dateFilter = $('#orderDateFilter');
if (dateFilter) dateFilter.value = ''; 
renderOrders('All', '', ''); 
} else if (targetPageId === 'customersPage') {
renderCustomers('');
} else if (targetPageId === 'servicesPage') {
renderServices('');
}
if (targetPageId === 'advertisementsPage') {
renderCurrentAdvertisementsTable(); 
}
});
});
}
function protectAdminRoute() {
const currentUser = JSON.parse(sessionStorage.getItem("currentUser") || "{}");
if (!currentUser || !currentUser.role || currentUser.role !== "admin") {
console.error("Access Denied! You must be an admin to view this page.");
window.location.href = "/index.html";
}
}
function setupLogout() {
const logoutBtn = $('#logoutBtn');
if (logoutBtn) {
logoutBtn.addEventListener('click', () => {
sessionStorage.clear();
window.location.href = "/index.html";
});
}
}
function updateDateTime() {
const now = new Date();
const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
const formattedDate = now.toLocaleDateString('en-US', options); 
const dateTimeElement = $('#currentDateTime');
if (dateTimeElement) {
dateTimeElement.textContent = formattedDate;
}
}
function setupMobileToggle() {
const menuToggleBtn = $('#menuToggleBtn');
const sidebar = $('.sidebar');
const appShell = $('.app-shell');
if (menuToggleBtn && sidebar && appShell) {
menuToggleBtn.addEventListener('click', (e) => {
e.stopPropagation();
sidebar.classList.toggle('hidden-mobile');
});
document.body.addEventListener('click', (e) => {
if (window.innerWidth <= 980 && !sidebar.classList.contains('hidden-mobile') && !menuToggleBtn.contains(e.target) && !sidebar.contains(e.target)) {
sidebar.classList.add('hidden-mobile');
}
});
}
if (sidebar && window.innerWidth <= 980) {
sidebar.classList.add('hidden-mobile');
}
}
let allOrdersDataForDashboard = [];
async function loadDashboardStats() {
console.log("🟢 Starting to load dashboard stats...");
$$('.stat-value').forEach(el => el.textContent = '...');
try {
const ordersRes = await fetch("http://localhost:5000/api/orders");
if (!ordersRes.ok) throw new Error("Failed to fetch orders.");
const allOrders = await ordersRes.json();
console.log("✅ All orders fetched:", allOrders.length);
allOrdersDataForDashboard = allOrders;
const todayOrders = allOrders.filter(order => isToday(order.orderDate));
const todaySales = todayOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);
$('#statMonthlySale').textContent = formatCurrencyINR(todaySales);
$('#statMonthlyOrders').textContent = todayOrders.length;
const [
customersRes,
servicesRes,
] = await Promise.all([
fetch("http://localhost:5000/api/customers"),
fetch("http://localhost:5000/api/services"),
]);
try {
const customersData = await customersRes.json();
if (customersRes.ok && customersData.status === "success") {
$('#statCustomers').textContent = customersData.customers.length;
} else {
throw new Error("Invalid customer data format.");
}
} catch (e) {
console.error("❌ Failed to load total customers:", e);
$('#statCustomers').textContent = 'Error';
}
$('#statOrders').textContent = allOrders.length;
const lowStockProducts = allProductsData.filter(p => {
let stock = p.stock || 0;
if (p.variants && p.variants.length > 0) { 
stock = p.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
}
return stock > 0 && stock <= 5;
});
const statProducts = $('#statProducts');
if (statProducts) {
statProducts.textContent = allProductsData.length;
}
const kpiLowStock = $('#statLowStock'); 
if (kpiLowStock) {
kpiLowStock.textContent = lowStockProducts.length;
}
try {
const serviceData = await servicesRes.json();
if (servicesRes.ok) {
$('#statServices').textContent = serviceData.length;
} else {
throw new Error("Invalid service data format.");
}
} catch (e) {
console.error("❌ Failed to load total services:", e);
$('#statServices').textContent = 'Error';
}
renderDailyRevenueChart(allOrdersDataForDashboard);
setupDailyRevenueChartControls();
renderTopSellingProductsChart(allOrdersDataForDashboard);
setupTopSellingChartControls();
const lowStockList = $('#lowStockList');
if (lowStockList) {
lowStockList.innerHTML = '';
const sortedLowStockProducts = lowStockProducts.sort((a, b) => {
let stockA = a.stock || 0;
if (a.variants && a.variants.length > 0) {
stockA = a.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
}
let stockB = b.stock || 0;
if (b.variants && b.variants.length > 0) {
stockB = b.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
}
return stockA - stockB;
}); 
if (sortedLowStockProducts.length === 0) {
lowStockList.innerHTML = '<p class="empty-state">All products are well stocked! 🎉</p>';
} else {
sortedLowStockProducts.forEach(p => { 
let stock = p.stock || 0;
if (p.variants && p.variants.length > 0) {
stock = p.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
}
const categoryName = p.category.charAt(0).toUpperCase() + p.category.slice(1);
lowStockList.innerHTML += `
<li class="list-item">
<span>${categoryName}</span>
<span>${p.name}</span>
<span class="stock-count danger">${stock}</span>
</li>
`;
});
}
}
renderRecentOrders(allOrders);
} catch (error) {
console.error("❌ Error fetching dashboard stats:", error);
showMessage("Initialization Error", "Failed to load dashboard statistics. Check backend API connection.");
$$('.stat-value').forEach(el => {
if (el.textContent === '...') {
el.textContent = 'Error';
}
});
}
}
let dailyRevenueChart;
function renderDailyRevenueChart(orders, targetYear = new Date().getFullYear(), targetMonth = new Date().getMonth()) {
if (dailyRevenueChart) {
dailyRevenueChart.destroy();
}
const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
const labels = Array.from({length: daysInMonth}, (_, i) => i + 1);
const dailyRevenue = {};
orders.forEach(order => {
const date = new Date(order.orderDate);
if (date.getMonth() === targetMonth && date.getFullYear() === targetYear) {
const day = date.getDate();
dailyRevenue[day] = (dailyRevenue[day] || 0) + parseFloat(order.total || 0);
}
});
const revenues = labels.map(day => dailyRevenue[day] || 0);
const maxRevenue = Math.max(...revenues);
const yAxisMax = Math.ceil(maxRevenue / 20000) * 20000;
const chartElement = $('#dailyOrderChart');
if (!chartElement) return;
const ctx = chartElement.getContext('2d');
dailyRevenueChart = new Chart(ctx, {
type: 'line',
data: {
labels: labels,
datasets: [{
label: `Daily Revenue - ${targetYear}`,
data: revenues,
borderColor: 'rgb(249, 115, 22)', 
tension: 0.3, 
fill: true,
backgroundColor: 'rgba(251, 146, 60, 0.4)'
}]
},
options: {
responsive: true,
maintainAspectRatio: false, 
scales: {
x: {
title: {
display: true,
text: `Date of ${new Date(targetYear, targetMonth).toLocaleString('en-US', { month: 'long' })}`,
font: { size: 14, weight: 'bold' }
}
},
y: {
beginAtZero: true,
title: {
display: true,
text: 'Revenue (₹)',
font: { size: 14, weight: 'bold' }
},
ticks: {
stepSize: 20000,
callback: function(value, index, values) {
return '₹' + value.toLocaleString('en-IN');
}
},
max: yAxisMax > 0 ? yAxisMax : 20000 
}
}
}
});
}
function setupDailyRevenueChartControls() {
const monthSelect = $('#dailyRevenueMonthSelect');
const yearSelect = $('#dailyRevenueYearSelect');
if (!monthSelect || !yearSelect) {
return;
}
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
if (monthSelect.options.length === 0) {
monthSelect.innerHTML = '';
months.forEach((m, index) => {
monthSelect.options.add(new Option(m, index));
});
}
if (yearSelect.options.length === 0) {
yearSelect.innerHTML = '';
for (let y = currentYear; y >= currentYear - 4; y--) {
yearSelect.options.add(new Option(y, y));
}
}
monthSelect.value = currentMonth;
yearSelect.value = currentYear;
const updateChart = () => {
const selectedMonth = parseInt(monthSelect.value);
const selectedYear = parseInt(yearSelect.value);
if (!isNaN(selectedMonth) && !isNaN(selectedYear) && allOrdersDataForDashboard.length > 0) {
renderTopSellingProductsChart(allOrdersDataForDashboard, selectedYear, selectedMonth);
}
};
monthSelect.addEventListener('change', updateChart);
yearSelect.addEventListener('change', updateChart);
}
let topSellingProductsChart;
function renderTopSellingProductsChart(allOrders, targetYear = new Date().getFullYear(), targetMonth = new Date().getMonth()) {
if (topSellingProductsChart) {
topSellingProductsChart.destroy();
}
const filteredOrders = allOrders.filter(order => {
const date = new Date(order.orderDate);
return date.getMonth() === targetMonth && date.getFullYear() === targetYear;
});
const productSalesMap = {};
filteredOrders.forEach(order => {
const productsSummary = (typeof order.products_summary === 'string') 
? JSON.parse(order.products_summary) 
: order.products_summary;
if (Array.isArray(productsSummary)) {
productsSummary.forEach(product => {
const name = product.name || 'Unknown Product';
const quantity = parseInt(product.quantity) || 0; 
productSalesMap[name] = (productSalesMap[name] || 0) + quantity;
});
}
});
const sortedProducts = Object.entries(productSalesMap)
.map(([name, units]) => ({ name, units }))
.sort((a, b) => b.units - a.units)
.slice(0, 5);
const labels = sortedProducts.map(item => item.name);
const unitsSold = sortedProducts.map(item => item.units);
const topSellingChartContainer = $('#topSellingProductsChartContainer');
const ctx = $('#topSellingProductsChart');
if (!ctx) return;
if (topSellingChartContainer) {
topSellingChartContainer.style.display = 'block';
}
const chartTitle = `Units Sold - ${new Date(targetYear, targetMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
topSellingProductsChart = new Chart(ctx.getContext('2d'), {
type: 'bar',
data: {
labels: labels,
datasets: [{
label: chartTitle,
data: unitsSold,
backgroundColor: 'rgba(20, 184, 166, 0.9)', 
borderColor: 'rgb(13, 148, 136)', 
borderWidth: 1
}]
},
options: {
responsive: true,
maintainAspectRatio: false,
scales: {
x: {
title: {
display: true,
text: 'Product Name',
font: { size: 14, weight: 'bold' }
}
},
y: {
beginAtZero: true,
title: {
display: true,
text: 'Units Sold',
font: { size: 14, weight: 'bold' }
},
ticks: {
stepSize: 2,
callback: function(value) {
if (Number.isInteger(value)) {
return value;
}
}
}
}
}
}
});
}
function setupTopSellingChartControls() {
const monthSelect = $('#topSellingMonthSelect');
const yearSelect = $('#topSellingYearSelect');
if (!monthSelect || !yearSelect) {
return;
}
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
if (monthSelect.options.length === 0) {
monthSelect.innerHTML = '';
months.forEach((m, index) => {
monthSelect.options.add(new Option(m, index));
});
}
if (yearSelect.options.length === 0) {
yearSelect.innerHTML = '';
for (let y = currentYear; y >= currentYear - 4; y--) {
yearSelect.options.add(new Option(y, y));
}
}
monthSelect.value = currentMonth;
yearSelect.value = currentYear;
const updateChart = () => {
const selectedMonth = parseInt(monthSelect.value);
const selectedYear = parseInt(yearSelect.value);
if (!isNaN(selectedMonth) && !isNaN(selectedYear) && allOrdersDataForDashboard.length > 0) {
renderTopSellingProductsChart(allOrdersDataForDashboard, selectedYear, selectedMonth);
}
};
monthSelect.addEventListener('change', updateChart);
yearSelect.addEventListener('change', updateChart);
}
function renderStatusBadge(status) {
const statusMap = {
'Pending': 'red',
'Shipped': 'green',
'Delivered': 'blue',
'Cancelled': 'yellow',
'Paid': 'blue', 
};
const color = statusMap[status] || 'gray';
return `<span class="badge ${color}">${status || '-'}</span>`;
}
function parseProductSummary(summary) {
if (!summary) return { products: 'N/A', quantities: 'N/A', images: [] };
try {
const products = (typeof summary === 'string') ? JSON.parse(summary) : summary;
if (Array.isArray(products) && products.length > 0) {
return {
products: products.map(p => p.name || 'Unknown').join('<br>'),
quantities: products.map(p => p.quantity || '0').join('<br>'),
images: products.map(p => p.image || null)
};
}
} catch (e) {
console.warn("Invalid JSON in products_summary:", e);
return { products: 'N/A', quantities: 'N/A', images: [] };
}
return { products: 'N/A', quantities: 'N/A', images: [] };
}
async function renderRecentOrders(initialOrders = null) {
const recentOrdersBody = $('#recentOrdersBody');
if (!recentOrdersBody) return;
recentOrdersBody.innerHTML = `<tr><td colspan="4" class="empty">Loading...</td></tr>`;
let ordersToRender = initialOrders;
try {
if (!ordersToRender || ordersToRender.length === 0) {
const response = await fetch("http://localhost:5000/api/orders");
if (!response.ok) throw new Error("Failed to fetch orders.");
ordersToRender = await response.json();
}
const recentOrders = ordersToRender.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate)).slice(0, 5);
if (!recentOrders.length) {
recentOrdersBody.innerHTML = `<tr><td colspan="4" class="empty">No recent orders.</td></tr>`;
return;
}
recentOrdersBody.innerHTML = '';
recentOrders.forEach(order => {
const row = document.createElement('tr');
const total = parseFloat(order.total) || 0;
row.innerHTML = `
<td>${order.orderId || '-'}</td>
<td>${order.customerName || '-'}</td>
<td>${formatCurrencyINR(total)}</td>
<td>${renderStatusBadge(order.status)}</td>
`;
recentOrdersBody.appendChild(row);
});
} catch (error) {
console.error("Error fetching recent orders:", error);
recentOrdersBody.innerHTML = `<tr><td colspan="4" class="empty">Could not load recent orders.</td></tr>`;
}
}
let allProductsData = [];
async function fetchAllProducts() {
try {
const response = await fetch("http://localhost:5000/api/products");
if (!response.ok) {
throw new Error(`HTTP error! Status: ${response.status}`);
}
let products = await response.json();
allProductsData = products.map(p => ({
...p,
variants: typeof p.variants === 'string' ? JSON.parse(p.variants || '[]') : (p.variants || []),
images: typeof p.images === 'string' ? JSON.parse(p.images || '[]') : (p.images || []),
specs: typeof p.specs === 'string' ? JSON.parse(p.specs || '{}') : (p.specs || {}),
ratingBreakdown: typeof p.ratingBreakdown === 'string' ? JSON.parse(p.ratingBreakdown || '{}') : (p.ratingBreakdown || {})
}));
return allProductsData;
} catch (error) {
console.error("Error fetching all products:", error);
showMessage("Product Error", "Failed to fetch product data from the server.");
return [];
}
}
async function renderProducts(categoryFilter = 'All', searchQuery = '') {
const productsBody = $('#productsBody');
if (!productsBody) return;
productsBody.innerHTML = `<tr><td colspan="9" class="empty">Products are loading...</td></tr>`;
if (allProductsData.length === 0) {
await fetchAllProducts();
}
let filteredProducts = allProductsData;
if (categoryFilter !== 'All') {
filteredProducts = filteredProducts.filter(p => p.category === categoryFilter);
}
const query = searchQuery.toLowerCase().trim();
if (query) {
filteredProducts = filteredProducts.filter(p => 
p.name.toLowerCase().includes(query) || 
(p.brand && p.brand.toLowerCase().includes(query))
);
}
const statProducts = $('#statProducts');
if (statProducts) {
statProducts.textContent = allProductsData.length; 
}
productsBody.innerHTML = '';
if (!filteredProducts.length) {
productsBody.innerHTML = `<tr><td colspan="9" class="empty">There are no products matching your criteria.</td></tr>`;
return;
}
const now = new Date();
filteredProducts.forEach((product) => {
const row = document.createElement('tr');
let variantsHTML = '<div>-</div>';
let priceHTML = `<div>${formatCurrencyINR(product.price)}</div>`;
let mrpPriceHTML = `<div>${formatCurrencyINR(product.mrp_price)}</div>`;
let totalProductStock = product.stock || 0; 
let stockHTML;
const productDiscountEndDate = product.discount_end_date ? new Date(product.discount_end_date) : null;
const isProductDiscountExpired = productDiscountEndDate && now > productDiscountEndDate;
if (product.variants && product.variants.length > 0) {
const parsedVariants = product.variants; 
variantsHTML = parsedVariants.map(v => `<div class="variant-item">${v.specName}</div>`).join('');
mrpPriceHTML = parsedVariants.map(v => `<div class="mrp-price-item">${formatCurrencyINR(v.mrp_price)}</div>`).join('');
stockHTML = parsedVariants.map(v => {
const stock = parseInt(v.stock) || 0;
const stockClass = stock === 0 ? 'out-of-stock' : (stock <= 5 ? 'low-stock' : '');
return `<div class="stock-item ${stockClass}">${stock === 0 ? 'Out of Stock' : stock}</div>`;
}).join('');
priceHTML = parsedVariants.map(v => {
const discountEndDate = v.discount_end_date ? new Date(v.discount_end_date) : null;
const isDiscountExpired = discountEndDate && now > discountEndDate;
const displayPrice = isDiscountExpired ? null : v.price;
return `<div class="price-item">${formatCurrencyINR(displayPrice)}</div>`;
}).join('');
totalProductStock = parsedVariants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
} else {
const stockClass = totalProductStock === 0 ? 'out-of-stock' : (totalProductStock <= 5 ? 'low-stock' : '');
stockHTML = `<div class="stock-item ${stockClass}">${totalProductStock === 0 ? 'Out of Stock' : totalProductStock}</div>`;
const displayPrice = isProductDiscountExpired ? null : product.price;
priceHTML = `<div>${formatCurrencyINR(displayPrice)}</div>`;
}
row.innerHTML = `
<td>${product.id}</td>
<td>${product.name}</td>
<td>${product.brand || '-'}</td>
<td>${product.category}</td>
<td class="variants-cell">${variantsHTML}</td>
<td class="stock-summary-cell">${stockHTML}</td>
<td>${mrpPriceHTML}</td>
<td>${priceHTML}</td>
<td>
<button class="btn small" data-action="edit-product" data-id="${product.id}">Edit</button>
<button class="btn small danger" data-action="delete-product" data-id="${product.id}">Delete</button>
</td>
`;
productsBody.appendChild(row);
});
$$('#productsBody [data-action]').forEach(button => button.addEventListener('click', handleProductAction));
}
function setupProductFilters() {
$$('.product-filter-btn').forEach(btn => {
btn.addEventListener('click', (e) => {
const category = e.currentTarget.dataset.category;
$$('.product-filter-btn').forEach(b => b.classList.remove('active'));
e.currentTarget.classList.add('active');
const searchQuery = $('#productsPageSearch')?.value || '';
renderProducts(category, searchQuery);
});
});
}
async function handleProductAction(event) {
const { id, action } = event.currentTarget.dataset;
if (action === 'delete-product') {
if (!confirm(`Are you sure you want to delete product ID: ${id}?`)) return;
try {
const response = await fetch(`http://localhost:5000/api/products/${id}`, {
method: 'DELETE',
});
if (response.ok) {
allProductsData = allProductsData.filter(p => p.id !== parseInt(id));
showMessage("Success", "Product deleted successfully.");
const searchQuery = $('#productsPageSearch')?.value || '';
renderProducts(getCurrentProductFilter(), searchQuery);
loadDashboardStats();
} else {
const errorResult = await response.json();
showMessage("Error", "Failed to delete product: " + (errorResult.error || 'Unknown Error'));
}
} catch (error) {
console.error("Error deleting product:", error);
showMessage("Error", "Error connecting to the server for deletion.");
}
return;
} else if (action === 'edit-product') {
try {
const response = await fetch(`http://localhost:5000/api/products/${id}`);
if (response.ok) {
const product = await response.json();
const cachedProduct = allProductsData.find(p => p.id == id);
const productToEdit = { 
...product, 
variants: cachedProduct.variants,
images: cachedProduct.images
}; 
openProductModal('Edit Product', productToEdit);
} else {
showMessage('Error', 'Failed to fetch product details for editing.');
}
} catch (error) {
console.error('Error fetching product details:', error);
showMessage('Error', 'Error connecting to the server for product details.');
}
}
}
function getCurrentProductFilter() {
const activeBtn = $('.product-filter-btn.active');
return activeBtn ? activeBtn.dataset.category : 'All';
}
let allOrdersData = [];
async function fetchAllOrders() {
try {
const response = await fetch("http://localhost:5000/api/orders");
if (!response.ok) throw new Error('Network response was not ok.');
allOrdersData = await response.json();
return allOrdersData;
} catch (error) {
console.error("Error fetching all orders:", error);
showMessage("Order Error", "Failed to fetch order data from the server.");
return [];
}
}
function getCurrentOrderDateFilter() {
const dateFilter = $('#orderDateFilter');
return dateFilter ? dateFilter.value : ''; 
}
async function renderOrders(statusFilter = 'All', searchQuery = '', dateFilterString = '') {
const ordersBody = $('#ordersBody');
if (!ordersBody) return;
ordersBody.innerHTML = `<tr><td colspan="6" class="empty">Loading...</td></tr>`;
if (allOrdersData.length === 0) {
await fetchAllOrders();
}
let filteredOrders = allOrdersData;
if (statusFilter !== 'All') {
filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
}
if (dateFilterString) {
filteredOrders = filteredOrders.filter(order => {
return matchesDate(order.orderDate, dateFilterString);
});
}
const query = searchQuery.toLowerCase().trim();
if (query) {
filteredOrders = filteredOrders.filter(order => 
(order.customerName && order.customerName.toLowerCase().includes(query)) || 
(order.orderId && String(order.orderId).toLowerCase().includes(query))
);
}
if (!filteredOrders.length) {
ordersBody.innerHTML = `<tr><td colspan="6" class="empty">No orders matching your criteria.</td></tr>`;
return;
}
ordersBody.innerHTML = ''; 
filteredOrders.forEach(order => {
const row = document.createElement('tr');
const total = parseFloat(order.total) || 0;
const isCancelled = order.status === 'Cancelled';
const statusOptions = ['Pending', 'Shipped', 'Delivered', 'Cancelled']; 
const finalStatusOptions = statusOptions.filter(s => ['Pending', 'Shipped', 'Delivered', 'Cancelled'].includes(s));
const statusSelectHTML = `
<select data-role="status-selector" data-id="${order.id}" ${isCancelled ? 'disabled' : ''}>
${finalStatusOptions.map(s => 
`<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
</select>
`;
row.innerHTML = `
<td>${order.orderId || '-'}</td>
<td>${order.customerName || '-'}</td>
<td>${formatCurrencyINR(total)}</td>
<td>${new Date(order.orderDate).toLocaleDateString()}</td>
<td>${statusSelectHTML}</td>
<td>
<button class="btn small" data-action="view-order" data-id="${order.id}">View</button>
<button class="btn small danger" data-action="remove-order" data-id="${order.id}">Delete</button>
</td>
`;
ordersBody.appendChild(row);
});
$$('[data-role="status-selector"]').forEach(select => {
if (!select.disabled) { 
select.addEventListener('change', handleOrderStatusChange);
}
});
$$('#ordersBody [data-action]').forEach(button => button.addEventListener('click', handleOrderAction));
}
async function handleOrderStatusChange(event) {
const selectElement = event.currentTarget;
const { id } = selectElement.dataset;
const newStatus = selectElement.value;
const orderToUpdate = allOrdersData.find(o => o.id == id);
if (!orderToUpdate) {
showMessage("Error", "Order data not found locally.");
return;
}
const isPrepaid = orderToUpdate.payment_method === 'online' || orderToUpdate.payment_method === 'upi' || orderToUpdate.payment_method === 'Online Pay';
if (isPrepaid) {
if (orderToUpdate.status === 'Delivered' && (newStatus === 'Pending' || newStatus === 'Shipped')) {
showMessage("Action Blocked", "This is a prepaid order. You cannot revert its status back to Pending or Shipped after it has been delivered.");
selectElement.value = orderToUpdate.status;
return;
}
if (newStatus === 'Cancelled' && orderToUpdate.status !== 'Cancelled') {
if (!confirm("Warning: This is a prepaid order. Are you sure you want to cancel it? You must manually process the refund.")) {
selectElement.value = orderToUpdate.status;
return;
}
}
}
try {
const response = await fetch(`http://localhost:5000/api/orders/${id}`, {
method: 'PUT',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ status: newStatus })
});
if (response.ok) {
const result = await response.json(); 
showMessage("Success", result.message || "Order status updated successfully!");
await fetchAllOrders(); 
loadDashboardStats(); 
const searchQuery = $('#ordersPageSearch')?.value || '';
const dateFilterString = getCurrentOrderDateFilter();
renderOrders(getCurrentStatusFilter(), searchQuery, dateFilterString);
} else {
const errorResult = await response.json();
console.error("Failed to update order status.", errorResult);
showMessage("Error!", "Failed to update order status: " + (errorResult.error || 'Unknown Error'));
selectElement.value = orderToUpdate.status;
}
} catch (error) {
console.error("Error updating order status:", error);
showMessage("Error!", "An error occurred while communicating with the server.");
selectElement.value = orderToUpdate.status;
}
}
const closeOrderViewModalBtn = $('#closeOrderViewModal');
if (closeOrderViewModalBtn) {
closeOrderViewModalBtn.addEventListener('click', closeOrderViewModal);
}
function closeOrderViewModal() {
const orderViewModal = $('#orderViewModal');
if (orderViewModal) {
orderViewModal.classList.add('hidden');
document.body.classList.remove('no-scroll');
}
}
async function openOrderViewModal(orderId) {
const orderViewModal = $('#orderViewModal');
const orderViewContent = $('#orderViewContent');
if (!orderViewModal || !orderViewContent) return;
orderViewContent.innerHTML = 'Loading order details...';
orderViewModal.classList.remove('hidden');
document.body.classList.add('no-scroll');
try {
let order = allOrdersData.find(o => o.id == orderId);
if (!order) {
const response = await fetch(`http://localhost:5000/api/orders/${orderId}`);
if (!response.ok) throw new Error('Failed to fetch order details');
order = await response.json();
}
if (!order) {
orderViewContent.innerHTML = 'Order not found.';
return;
}
const paymentStatus = getPaymentStatus(order);
const products = (typeof order.products_summary === 'string' && order.products_summary) ? JSON.parse(order.products_summary) : (order.products_summary || []);

// --- START NEW HTML STRUCTURE (Your Requested Simple List Format) ---
const productsHtml = Array.isArray(products) ? products.map(p => {
    // Determine the product name and variant
    const productName = p.name || 'Unknown Product';
    const variant = p.specName ? ` (${p.specName})` : '';
    // Use the specific price of the product from the summary, otherwise total
    const productPrice = parseFloat(p.price || p.mrp_price || 0) * parseInt(p.quantity || 1); 
    const formattedProductPrice = formatCurrencyINR(productPrice);
    
    // Calculate and display original unit price
    const originalUnitPrice = parseFloat(p.mrp_price || p.price || 0);
    const formattedOriginalUnitPrice = formatCurrencyINR(originalUnitPrice);

    return `
        <div class="modal-product-item" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 4px; display: flex; align-items: flex-start; gap: 10px;">
            <img src="${p.image}" alt="${productName}" class="modal-product-image" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; flex-shrink: 0;">
            <div style="flex-grow: 1;">
                <p style="margin: 0 0 5px 0;"><strong>Product:</strong> ${productName}${variant} (Qty: ${p.quantity || 1})</p>
                <p style="margin: 0; font-size: 0.9em; color: #555;"><strong>Unit Price (MRP/Base):</strong> ${formattedOriginalUnitPrice}</p>
                <p style="margin: 0; font-weight: bold; color: #2ecc71;"><strong>Item Total:</strong> ${formattedProductPrice}</p>
            </div>
        </div>
    `;
}).join('') : '<p>No product summary available.</p>';

const paymentMethodDisplay = order.payment_method ? order.payment_method.toUpperCase().replace('-', ' - ') : 'N/A';
const formattedTotalAmount = formatCurrencyINR(order.total);


orderViewContent.innerHTML = `
    <div style="padding: 10px;">
        
        <h3 style="border-bottom: 1px solid #eee; padding-bottom: 5px;">Order Details</h3>
        
        <p style="font-size: 1.1em; font-weight: bold; margin-top: 10px;">Order ID: ${order.orderId || '-'}</p>
        <p>Order Date: ${new Date(order.orderDate).toLocaleDateString()}</p>
        
        <div style="margin-top: 20px;">
            <h4 style="border-bottom: 1px dashed #ddd; padding-bottom: 5px;">Ordered Products</h4>
            ${productsHtml}
        </div>
        
        <p style="font-size: 1.2em; font-weight: bold; margin-top: 20px; border-top: 2px solid #333; padding-top: 10px;">
            Total Amount (Incl. GST/Taxes): <span style="color: #2ecc71;">${formattedTotalAmount}</span>
        </p>
        
        <p style="margin-top: 15px;">
            <strong>Payment Method:</strong> ${paymentMethodDisplay}
        </p>
        <p>
            <strong>Payment Status:</strong> <span class="badge ${paymentStatus.class}">${paymentStatus.text}</span>
        </p>

        <p>
            <strong>Order Status:</strong> ${renderStatusBadge(order.status)}
        </p>

        <h3 style="border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 25px;">Shipping Address</h3>
        <p style="white-space: pre-wrap;">${order.customerAddress || 'N/A'}</p>
        
        <h3 style="border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 25px;">Customer Contact Info</h3>
        <p><strong>Name:</strong> ${order.customerName || '-'}</p>
        <p><strong>Phone:</strong> ${order.customerPhone || '-'}</p>
        <p><strong>Email:</strong> ${order.userEmail || '-'}</p>
    </div>
`;
// --- END NEW HTML STRUCTURE ---

} catch (error) {
console.error("Error fetching order details:", error);
orderViewContent.innerHTML = 'Could not load order details.';
}
}
async function handleOrderAction(event) {
const { id, action } = event.currentTarget.dataset;
if (action === 'remove-order') {
if (!confirm(`Are you sure you want to delete order ID: ${id}?`)) return;
try {
const response = await fetch(`http://localhost:5000/api/orders/${id}`, {
method: 'DELETE'
});
if (response.ok) {
showMessage('Success', 'Order removed successfully.');
await fetchAllOrders(); 
loadDashboardStats(); 
const searchQuery = $('#ordersPageSearch')?.value || '';
const dateFilterString = getCurrentOrderDateFilter();
renderOrders(getCurrentStatusFilter(), searchQuery, dateFilterString);
} else {
const errorResult = await response.json();
showMessage("Error", "Failed to remove order: " + (errorResult.error || 'Unknown Error'));
}
} catch (error) {
console.error("Error removing order:", error);
showMessage("Error", "Error connecting to the server for order removal.");
}
} else if (action === 'view-order') {
openOrderViewModal(id);
}
}
function setupOrderFilters() {
$$('.order-filter-btn').forEach(btn => {
btn.addEventListener('click', (e) => {
const status = e.currentTarget.dataset.status;
$$('.order-filter-btn').forEach(b => b.classList.remove('active'));
e.currentTarget.classList.add('active');
const searchQuery = $('#ordersPageSearch')?.value || '';
const dateFilterString = getCurrentOrderDateFilter();
renderOrders(status, searchQuery, dateFilterString);
});
});
}
function getCurrentStatusFilter() {
const activeBtn = $('.order-filter-btn.active');
return activeBtn ? activeBtn.dataset.status : 'All';
}
function setupOrderDateFilterInput() {
const applyBtn = $('#applyOrderDateFilter');
const clearBtn = $('#clearOrderDateFilter'); 
const dateFilter = $('#orderDateFilter');
if (!applyBtn || !clearBtn || !dateFilter) return;
applyBtn.addEventListener('click', () => {
const statusFilter = getCurrentStatusFilter();
const searchQuery = $('#ordersPageSearch')?.value || '';
const dateFilterString = dateFilter.value; 
renderOrders(statusFilter, searchQuery, dateFilterString);
});
clearBtn.addEventListener('click', () => {
dateFilter.value = ''; 
const statusFilter = getCurrentStatusFilter();
const searchQuery = $('#ordersPageSearch')?.value || '';
renderOrders(statusFilter, searchQuery, '');
});
}
async function renderCustomers(searchQuery = '') {
const customersBody = document.querySelector('#customersBody');
if (!customersBody) return;
customersBody.innerHTML = '<tr><td colspan="4" class="empty">Loading customers...</td></tr>';
try {
const res = await fetch("http://localhost:5000/api/customers");
const data = await res.json();
let filteredCustomers = data.customers || [];
const query = searchQuery.toLowerCase().trim();
if (query) {
filteredCustomers = filteredCustomers.filter(c => 
(c.first_name && c.first_name.toLowerCase().includes(query)) || 
(c.last_name && c.last_name.toLowerCase().includes(query)) ||
(c.email && c.email.toLowerCase().includes(query))
);
}
customersBody.innerHTML = "";
if (data.status === "success" && filteredCustomers.length > 0) {
filteredCustomers.forEach((customer, index) => {
const row = document.createElement("tr");
row.innerHTML = `
<td>${index + 1}</td>
<td>${customer.first_name || ''} ${customer.last_name || ''}</td>
<td>${customer.email || '-'}</td>
<td>${new Date(customer.created_at).toLocaleDateString()}</td>
`;
customersBody.appendChild(row);
});
} else {
customersBody.innerHTML = `<tr><td colspan="4" class="empty">No customers matching your criteria.</td></tr>`;
}
} catch (error) {
console.error("Error fetching customers:", error);
customersBody.innerHTML = `<tr><td colspan="4" class="empty">Could not load customers.</td></tr>`;
}
}
async function renderServices(searchQuery = '') {
const servicesBody = $('#servicesBody');
if (!servicesBody) return;
servicesBody.innerHTML = `<tr><td colspan="8" class="empty">Loading service requests...</td></tr>`;
try {
const response = await fetch("http://localhost:5000/api/services");
if (!response.ok) throw new Error('Network response was not ok.');
const serviceRequests = await response.json();
let filteredServices = serviceRequests;
const query = searchQuery.toLowerCase().trim();
if (query) {
filteredServices = filteredServices.filter(s => 
(s.name && s.name.toLowerCase().includes(query)) || 
(s.phone && String(s.phone).includes(query)) ||
(s.deviceType && s.deviceType.toLowerCase().includes(query))
);
}
if (filteredServices.length === 0) {
servicesBody.innerHTML = `<tr><td colspan="8" class="empty">No service requests matching your criteria.</td></tr>`;
return;
}
servicesBody.innerHTML = '';
filteredServices.forEach(service => {
const row = document.createElement('tr');
row.innerHTML = `
<td>${service.id}</td>
<td>${service.name}</td>
<td>${service.phone}</td>
<td>${service.email || '-'}</td>
<td>${service.deviceType}</td>
<td>${service.issue}</td>
<td>${new Date(service.createdAt).toLocaleString()}</td>
<td>
<button class="btn small primary" data-action="view-service" data-id="${service.id}">View</button>
</td>
`;
servicesBody.appendChild(row);
});
$$('#servicesBody [data-action="view-service"]').forEach(button => {
button.addEventListener('click', handleServiceAction);
});
} catch (error) {
console.error("Error fetching service requests:", error);
servicesBody.innerHTML = `<tr><td colspan="8" class="empty">Could not load service requests.`;
}
}
function handleServiceAction(event) {
const { id, action } = event.currentTarget.dataset;
if (action === 'view-service') {
openServiceViewModal(id);
}
}
async function openServiceViewModal(serviceId) {
const serviceViewModal = $('#serviceViewModal');
const serviceViewContent = $('#serviceViewContent');
if (!serviceViewModal || !serviceViewContent) return;
serviceViewContent.innerHTML = 'Loading service details...';
serviceViewModal.classList.remove('hidden');
document.body.classList.add('no-scroll');
try {
const response = await fetch("http://localhost:5000/api/services");
if (!response.ok) throw new Error('Failed to fetch service details');
const allServices = await response.json();
const service = allServices.find(s => s.id == serviceId);
if (!service) {
serviceViewContent.innerHTML = 'Service request not found.';
return;
}
const deviceDetailsHTML = service.model ? `<strong>Model:</strong> ${service.model}` : '';
const customerEmail = service.email || '';
serviceViewContent.innerHTML = `
<div class="card p-5 service-details-card-inner">
<h3>Service Request Details</h3>
<p><strong>Name:</strong> ${service.name}</p>
<p><strong>Phone:</strong> ${service.phone}</p>
<p><strong>Email:</strong> ${customerEmail || '-'}</p>
<p><strong>Device:</strong> ${service.deviceType}</p>
<p>${deviceDetailsHTML}</p>
<p><strong>Issue:</strong> ${service.issue}</p>
<p><strong>Booking Date:</strong> ${new Date(service.createdAt).toLocaleString()}</p>
</div>
<div class="form-actions">
<button id="openSendMessageModalBtn" class="btn primary small" data-id="${serviceId}" data-name="${service.name}" data-email="${customerEmail}">Send Message</button>
</div>
`;
const openSendMessageBtn = $('#openSendMessageModalBtn');
if (openSendMessageBtn) {
openSendMessageBtn.addEventListener('click', (e) => {
const name = e.currentTarget.dataset.name;
const email = e.currentTarget.dataset.email;
const id = e.currentTarget.dataset.id;
openSendMessageModal(name, email, id);
});
}
} catch (error) {
console.error("Error fetching service details:", error);
serviceViewContent.innerHTML = 'Could not load service details.';
}
}
function openSendMessageModal(name, email, serviceId) {
let modal = $('#sendMessageModal');
const isEmailAvailable = email && email.trim() !== '';
if (!modal) return;
modal.classList.add('right-aligned');
modal.classList.remove('hidden');
document.body.classList.add('no-scroll');
$('#messageTextarea').value = '';
const msgCustomerNameElement = $('#msgCustomerName');
const msgCustomerEmailElement = $('#msgCustomerEmail');
if(msgCustomerNameElement) msgCustomerNameElement.textContent = name;
if(msgCustomerEmailElement) msgCustomerEmailElement.textContent = isEmailAvailable ? email : 'Email not available';
const backBtn = $('#backFromSendMessageModal');
if (backBtn) {
backBtn.dataset.serviceId = serviceId;
}
modal.addEventListener('click', (e) => {
if (e.target === modal) {
handleBackFromMessage();
}
});
const sendEmailBtn = $('#sendEmailBtn');
if (sendEmailBtn) {
sendEmailBtn.disabled = !isEmailAvailable;
sendEmailBtn.classList.toggle('disabled', !isEmailAvailable);
sendEmailBtn.onclick = null;
sendEmailBtn.onclick = async () => {
const message = $('#messageTextarea').value.trim();
if (message) {
const payload = {
type: 'email',
email: email,
message: `From Smart Tech Admin regarding your service request (ID: ${serviceId}):\n\n${message}`
};
const sent = await sendMessageToBackend(payload);
if (sent) {
showMessage("Success", "Message sent successfully!");
closeSendMessageModal();
}
} else {
showMessage("Message Empty", "Please type a message to send.");
}
};
}
if (backBtn) {
backBtn.onclick = handleBackFromMessage;
}
}
async function sendMessageToBackend(payload) {
try {
const response = await fetch('http://localhost:5000/api/send-message', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
const result = await response.json();
if (response.ok) {
return true;
} else {
showMessage('Error', result.error || 'An error occurred while sending the message.');
return false;
}
} catch (error) {
console.error('Error sending message:', error);
showMessage('Error', 'Could not connect to the server.');
return false;
}
}
function closeSendMessageModal() {
const sendMessageModal = $('#sendMessageModal');
if (sendMessageModal) {
sendMessageModal.classList.remove('right-aligned');
sendMessageModal.classList.add('hidden');
document.body.classList.remove('no-scroll');
sendMessageModal.removeEventListener('click', (e) => {
if (e.target === sendMessageModal) {
handleBackFromMessage();
}
});
}
}
function handleBackFromMessage() {
const sendMessageModal = $('#sendMessageModal');
const serviceId = $('#backFromSendMessageModal').dataset.serviceId;
if (sendMessageModal) {
sendMessageModal.classList.remove('right-aligned');
sendMessageModal.classList.add('hidden');
document.body.classList.remove('no-scroll');
}
if (serviceId) {
openServiceViewModal(serviceId);
}
}
const closeServiceViewModalBtn = $('#closeServiceViewModal');
if (closeServiceViewModalBtn) {
closeServiceViewModalBtn.addEventListener('click', () => {
const serviceViewModal = $('#serviceViewModal');
if (serviceViewModal) {
serviceViewModal.classList.add('hidden');
document.body.classList.remove('no-scroll');
}
});
}
const productModal = $('#productModal');
const productForm = $('#productForm');
const imagePreview = $('#imagePreview');
let editingProductId = null;
function addVariantRow(specName = '', price = '', mrp_price = '', discountEndDate = '', stock = '', isFirst = false) {
const variantsContainer = $('#variantsContainer');
if (!variantsContainer) return;
const variantGroup = document.createElement('div');
variantGroup.className = 'variant-group';
const removeButtonHTML = isFirst ? '' : `<button type="button" class="remove-variant-btn">✕</button>`;
variantGroup.innerHTML = `
${removeButtonHTML}
<div class="form-field">
<label for="variant-name">Specification</label>
<input type="text" class="variant-name" name="variant-name" placeholder="" value="${specName}" required/>
</div>
<div class="variant-price-group">
<div class="form-field">
<label for="variant-mrp-price">MRP Price</label>
<input type="number" class="variant-mrp-price" name="variant-mrp-price" placeholder="MRP Price" value="${mrp_price}" min="0" step="1" required/>
</div>
<div class="form-field">
<label for="variant-price">Price</label>
<input type="number" class="variant-price" name="variant-price" placeholder="Price" value="${price}" min="0" step="1" />
</div>
</div>
<div class="form-field variant-stock-field">
<label for="variant-stock">Stock</label>
<input type="number" class="variant-stock" name="variant-stock" placeholder="Stock" value="${stock}" min="0" step="1" required/>
</div>
<div class="form-field variant-discount-end-date">
<label for="variant-discount-end-date">Discount End Date</label>
<input type="datetime-local" class="variant-discount-end-date-input" name="variant-discount-end-date-input" value="${discountEndDate}">
</div>
`;
variantsContainer.appendChild(variantGroup);
if (!isFirst) {
const removeBtn = variantGroup.querySelector('.remove-variant-btn');
if (removeBtn) {
removeBtn.onclick = function() {
variantGroup.remove();
};
}
}
}
function setupProductModal() {
const openAddProductBtn = $('#openAddProduct');
if (openAddProductBtn) {
openAddProductBtn.addEventListener('click', () => openProductModal('Add New Product'));
}
const closeProductModalBtn = $('#closeProductModal');
if (closeProductModalBtn) {
closeProductModalBtn.addEventListener('click', closeProductModal);
}
const addVariantBtn = $('.add-variant-btn');
if (addVariantBtn) {
addVariantBtn.addEventListener('click', (e) => {
e.preventDefault();
addVariantRow();
});
}
function handleFileChange(event) {
const file = event.target.files[0];
const inputId = event.target.id;
const previewId = `preview-${inputId}`;
let previewWrapper = document.getElementById(previewId);
if (previewWrapper) {
previewWrapper.remove();
}
if (file) {
const reader = new FileReader();
reader.onload = (e) => {
previewWrapper = document.createElement('div');
previewWrapper.id = previewId;
previewWrapper.className = 'image-preview-item';
previewWrapper.dataset.type = 'new-upload';
if (imagePreview) {
imagePreview.appendChild(previewWrapper);
}
previewWrapper.innerHTML = `
<img src="${e.target.result}" alt="Image Preview">
<button type="button" class="remove-image-btn" data-input-id="${inputId}">✕</button>
`;
previewWrapper.style.display = 'block';
const targetInput = document.getElementById(inputId);
if (targetInput) {
delete targetInput.dataset.originalSrc; 
}
previewWrapper.querySelector('.remove-image-btn').addEventListener('click', (e) => {
const targetInputId = e.target.dataset.inputId;
const targetInput = document.getElementById(targetInputId);
if (targetInput) {
targetInput.value = null;
delete targetInput.dataset.originalSrc; 
}
document.getElementById(previewId)?.remove();
});
};
reader.readAsDataURL(file);
}
}
$$('input[type="file"]').forEach(input => {
input.addEventListener('change', handleFileChange);
});
if (productForm) {
productForm.addEventListener('submit', handleProductFormSubmit);
}
const resetProductFormBtn = $('#resetProductForm');
if (resetProductFormBtn) {
resetProductFormBtn.addEventListener('click', () => {
if (productForm) {
productForm.reset();
}
const variantsContainer = $('#variantsContainer');
if (variantsContainer) {
variantsContainer.innerHTML = '';
}
addVariantRow('', '', '', '', '', true); 
if (imagePreview) {
imagePreview.innerHTML = '';
}
$$('input[type="file"]').forEach(input => {
delete input.dataset.originalSrc;
});
editingProductId = null;
const pCategory = $('#pCategory');
if (pCategory) {
toggleVariantForm(pCategory.value);
}
});
}
const pCategory = $('#pCategory');
if (pCategory) {
pCategory.addEventListener('change', (e) => {
const category = e.target.value;
toggleVariantForm(category);
});
}
const initialCategory = $('#pCategory')?.value || 'mobiles';
toggleVariantForm(initialCategory);
}
function toggleVariantForm(category) {
const variantFields = $('#variantFields');
const singlePriceField = $('#singlePriceField');
const pPriceInput = $('#pPrice');
const pMRPPriceInput = $('#pMRPPrice');
const pStockInput = $('#pStock');
const pDiscountEndDateInput = $('#pDiscountEndDate');
const addVariantBtn = $('.add-variant-btn');
if (variantFields && singlePriceField && pPriceInput && pMRPPriceInput && pStockInput && pDiscountEndDateInput && addVariantBtn) {
if (category === 'mobiles' || category === 'seconds' || category === 'laptops') {
variantFields.style.display = 'block';
singlePriceField.style.display = 'none';
pMRPPriceInput.required = false;
pStockInput.required = false;
addVariantBtn.style.display = 'inline-block';
if ($$('#variantsContainer .variant-group').length === 0) {
addVariantRow('', '', '', '', '', true);
}
} else {
variantFields.style.display = 'none';
singlePriceField.style.display = 'block';
pMRPPriceInput.required = true;
pStockInput.required = true;
addVariantBtn.style.display = 'none';
}
pPriceInput.required = false; 
}
}
function openProductModal(title = 'Add New Product', product = null) {
const productModalTitle = $('#productModalTitle');
if (productModalTitle) productModalTitle.textContent = title;
if (productForm) productForm.reset();
const variantsContainer = $('#variantsContainer');
if (variantsContainer) variantsContainer.innerHTML = '';
if (imagePreview) imagePreview.innerHTML = '';
$$('input[type="file"]').forEach(input => {
input.value = null;
delete input.dataset.originalSrc;
});
editingProductId = product ? product.id : null;
const pDiscountEndDate = $('#pDiscountEndDate');
if (pDiscountEndDate) pDiscountEndDate.value = '';
if (product) {
if ($('#pName')) $('#pName').value = product.name || '';
if ($('#pCategory')) $('#pCategory').value = product.category || 'mobiles';
if ($('#pBrand')) $('#pBrand').value = product.brand || '';
if ($('#pDesc')) $('#pDesc').value = product.description || '';
const specsObject = product.specs || {};
if ($('#pFeatures')) $('#pFeatures').value = Object.entries(specsObject).map(([key, value]) => `${key}: ${value}`).join(', ');
if (product.variants && product.variants.length > 0) {
const now = new Date();
const parsedVariants = product.variants; 
parsedVariants.forEach((v, index) => {
const discountEndDate = v.discount_end_date ? new Date(v.discount_end_date) : null;
const isDiscountExpired = discountEndDate && now > discountEndDate;
const price = isDiscountExpired ? '' : v.price;
const discount_end_date = v.discount_end_date ? product.discount_end_date.substring(0, 16) : '';
addVariantRow(v.specName, price || '', v.mrp_price || '', discount_end_date || '', v.stock || 0, index === 0);
});
const totalStock = parsedVariants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
if ($('#pStock')) $('#pStock').value = totalStock;
} else {
const now = new Date();
const discountEndDate = product.discount_end_date ? new Date(product.discount_end_date) : null;
const isDiscountExpired = discountEndDate && now > discountEndDate;
if ($('#pPrice')) $('#pPrice').value = isDiscountExpired ? '' : product.price || '';
if ($('#pMRPPrice')) $('#pMRPPrice').value = product.mrp_price || '';
if ($('#pStock')) $('#pStock').value = product.stock || 0; 
if ($('#pDiscountEndDate')) {
$('#pDiscountEndDate').value = isDiscountExpired ? '' : (product.discount_end_date ? product.discount_end_date.substring(0, 16) : '');
}
addVariantRow('', '', '', '', '', true);
}
const pCategory = $('#pCategory');
if (pCategory) {
toggleVariantForm(pCategory.value);
}
const images = Array.isArray(product.images) ? product.images : []; 
const fileInputs = [$('#pImage1'), $('#pImage2'), $('#pImage3')];
images.forEach((src, index) => {
if (fileInputs[index] && imagePreview && src) {
fileInputs[index].dataset.originalSrc = src; 
const previewWrapper = document.createElement('div');
previewWrapper.className = 'image-preview-item';
const previewId = `preview-${fileInputs[index].id}`; 
previewWrapper.id = previewId;
previewWrapper.dataset.type = 'existing-image'; 
previewWrapper.innerHTML = `
<img src="${src}" alt="Image Preview">
<button type="button" class="remove-image-btn" data-input-id="${fileInputs[index].id}">✕</button>
`;
imagePreview.appendChild(previewWrapper);
previewWrapper.querySelector('.remove-image-btn').addEventListener('click', (e) => {
const targetInputId = e.target.dataset.inputId;
const targetInput = document.getElementById(targetInputId);
if (targetInput) {
targetInput.value = null;
delete targetInput.dataset.originalSrc; 
}
previewWrapper.remove();
});
}
});
} else {
addVariantRow('', '', '', '', '', true);
const pCategory = $('#pCategory');
if (pCategory) {
pCategory.value = 'mobiles';
toggleVariantForm(pCategory.value);
}
}
if (productModal) {
productModal.classList.remove('hidden');
document.body.classList.add('no-scroll');
}
}
function closeProductModal() {
if (productModal) {
productModal.classList.add('hidden');
document.body.classList.remove('no-scroll');
editingProductId = null;
if (productForm) productForm.reset(); 
if (imagePreview) imagePreview.innerHTML = ''; 
const variantsContainer = $('#variantsContainer');
if (variantsContainer) variantsContainer.innerHTML = ''; 
}
}
async function handleProductFormSubmit(event) {
event.preventDefault();
const pCategory = $('#pCategory');
if (!pCategory) return;
const category = pCategory.value;
let variants = [];
let price = null;
let mrp_price = 0;
let stock = 0;
let discount_end_date = null;
if (category === 'mobiles' || category === 'seconds' || category === 'laptops') {
const variantGroups = $$('.variant-group');
if (variantGroups.length === 0) {
showMessage('Variant Required', 'Please add at least one variant.');
return;
}
for (const group of variantGroups) {
const specNameInput = group.querySelector('.variant-name');
const mrpPriceInput = group.querySelector('.variant-mrp-price');
const stockInput = group.querySelector('.variant-stock');
if (!specNameInput.value.trim()) {
showMessage('Missing Specification', 'Please enter a specification name for all variants.');
specNameInput.focus();
return;
}
if (!mrpPriceInput.value || isNaN(parseFloat(mrpPriceInput.value))) {
showMessage('Invalid MRP Price', 'Please enter a valid MRP price for all variants.');
mrpPriceInput.focus();
return;
}
if (!stockInput.value || isNaN(parseInt(stockInput.value))) {
showMessage('Invalid Stock', 'Please enter a valid stock value for all variants.');
stockInput.focus();
return;
}
const variantPriceInput = group.querySelector('.variant-price');
const variantPrice = variantPriceInput.value ? parseFloat(variantPriceInput.value) : null;
const variantMRPPrice = parseFloat(mrpPriceInput.value);
const variantStock = parseInt(stockInput.value);
const variantDiscountEndDate = group.querySelector('.variant-discount-end-date-input').value || null;
variants.push({
specName: specNameInput.value.trim(),
price: variantPrice,
mrp_price: variantMRPPrice,
stock: variantStock,
discount_end_date: variantDiscountEndDate
});
}
price = variants[0].price;
mrp_price = variants[0].mrp_price;
stock = variants.reduce((acc, v) => acc + v.stock, 0);
discount_end_date = variants[0].discount_end_date;
} else {
const pMRPPrice = $('#pMRPPrice');
const pStock = $('#pStock');
if (!pMRPPrice.value || isNaN(parseFloat(pMRPPrice.value))) {
showMessage('MRP Price Required', 'Please provide a valid MRP price.');
pMRPPrice.focus();
return;
}
if (!pStock.value || isNaN(parseInt(pStock.value))) {
showMessage('Stock Required', 'Please provide a valid stock value.');
pStock.focus();
return;
}
const pPrice = $('#pPrice');
const pDiscountEndDate = $('#pDiscountEndDate');
const numericPrice = pPrice.value ? parseFloat(pPrice.value) : null;
if (isNaN(numericPrice)) {
price = null;
} else {
price = numericPrice;
}
mrp_price = parseFloat(pMRPPrice.value);
stock = parseInt(pStock.value);
discount_end_date = pDiscountEndDate.value || null;
}
const formData = new FormData();
const pFeatures = $('#pFeatures');
const pDesc = $('#pDesc');
const pName = $('#pName');
const pBrand = $('#pBrand');
if (!pFeatures || !pDesc || !pName || !pBrand) return;
const featuresText = pFeatures.value.trim();
let specs = {};
if (featuresText) {
featuresText.split(',').forEach(item => {
const parts = item.split(':').map(s => s.trim());
if (parts.length === 2 && parts[0] && parts[1]) {
specs[parts[0]] = parts[1];
}
});
}
formData.append('name', pName.value.trim());
formData.append('category', category.trim());
formData.append('brand', pBrand.value.trim());
formData.append('stock', stock);
formData.append('description', pDesc.value.trim());
formData.append('price', price);
formData.append('mrp_price', mrp_price);
formData.append('variants', JSON.stringify(variants));
formData.append('specs', JSON.stringify(specs));
formData.append('discount_end_date', discount_end_date);
const fileInputs = [$('#pImage1'), $('#pImage2'), $('#pImage3')];
const existingImageUrls = [];
fileInputs.forEach(input => {
if (input && input.files && input.files.length > 0) {
formData.append('images', input.files[0]);
} else if (input && input.dataset.originalSrc) {
existingImageUrls.push(input.dataset.originalSrc);
}
});
if (editingProductId) {
formData.append('existingImages', JSON.stringify(existingImageUrls));
}
const url = editingProductId 
? `http://localhost:5000/api/products/${editingProductId}`
: `http://localhost:5000/api/products`;
const method = editingProductId ? 'PUT' : 'POST';
try {
const response = await fetch(url, {
method: method,
body: formData,
});
if (response.ok) {
allProductsData = []; 
await fetchAllProducts(); 
const searchQuery = $('#productsPageSearch')?.value || '';
renderProducts(getCurrentProductFilter(), searchQuery);
loadDashboardStats();
closeProductModal();
showMessage("Success", "Product saved successfully!");
} else {
const errorResult = await response.json();
console.error("Failed to save product:", errorResult.error || 'Unknown Error');
showMessage("Error!", "Failed to save product: " + (errorResult.error || 'Unknown Error'));
}
} catch (error) {
console.error("Error submitting product form:", error);
showMessage("Error!", "An error occurred while saving the product.");
}
}
async function downloadReport(reportType) {
const doc = new window.jspdf.jsPDF();
doc.setFont('Helvetica');
doc.setFontSize(18);
doc.text(`Smart Tech Admin Report`, 105, 15, null, null, 'center');
doc.setFontSize(12);
doc.text(`Generated on ${new Date().toLocaleString()}`, 105, 22, null, null, 'center');
doc.line(20, 25, 190, 25);
doc.setFontSize(16);
doc.text(`${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`, 20, 35);
doc.setFontSize(10);
const startY = 45;
let y = startY;
let apiUrl = `http://localhost:5000/api/${reportType}`;
if (reportType === 'reviews') {
apiUrl = `http://localhost:5000/api/review-report`;
} else if (reportType === 'sales') {
apiUrl = `http://localhost:5000/api/orders`;
}
try {
const response = await fetch(apiUrl);
if (!response.ok) throw new Error(`Failed to fetch ${reportType} data.`);
const data = await response.json();
let reportData = data;
if (reportType === 'customers' && data.customers) {
reportData = data.customers;
}
if (!reportData || reportData.length === 0) {
doc.text(`No data available for ${reportType}.`, 20, y + 10);
} else {
let reportContent = [];
switch(reportType) {
case 'reviews':
data.forEach(item => {
reportContent.push({
'ID': item.id,
'Product': item.product_name,
'User': item.user_name,
'Rating': item.rating,
'Comment': item.comment,
'Date': new Date(item.createdAt).toLocaleDateString()
});
});
generateReviewsReport(doc, reportContent, y);
break;
case 'products':
if (allProductsData.length === 0) await fetchAllProducts();
allProductsData.forEach(item => {
const totalStock = (item.variants && item.variants.length > 0)
? item.variants.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0)
: (parseInt(item.stock) || 0);
reportContent.push({
'ID': item.id,
'Name': item.name,
'Category': item.category,
'Brand': item.brand,
'Stock': totalStock,
'Price': formatCurrencyINR(item.price),
'MRP Price': formatCurrencyINR(item.mrp_price)
});
});
doc.autoTable({
startY: y,
head: [['ID', 'Name', 'Category', 'Brand', 'Stock', 'Price', 'MRP Price']],
body: reportContent.map(item => Object.values(item))
});
break;
case 'orders':
data.forEach(item => {
reportContent.push({
'Order ID': item.orderId,
'Customer': item.customerName,
'Date': new Date(item.orderDate).toLocaleDateString(),
'Total': formatCurrencyINR(item.total),
'Status': item.status
});
});
doc.autoTable({
startY: y,
head: [['Order ID', 'Customer', 'Date', 'Total', 'Status']],
body: reportContent.map(item => Object.values(item))
});
break;
case 'customers':
reportData.forEach((item, index) => {
reportContent.push({
'ID': index + 1,
'Name': `${item.first_name || ''} ${item.last_name || ''}`,
'Email': item.email,
'Joined Date': new Date(item.created_at).toLocaleDateString()
});
});
doc.autoTable({
startY: y,
head: [['ID', 'Name', 'Email', 'Joined Date']],
body: reportContent.map(item => Object.values(item))
});
break;
case 'sales':
data.forEach(item => {
const productsSummary = (typeof item.products_summary === 'string' && item.products_summary)
? JSON.parse(item.products_summary)
: (item.products_summary || []);
reportContent.push({
'Order ID': item.orderId,
'Date': new Date(item.orderDate).toLocaleDateString(),
'Total Sales': formatCurrencyINR(item.total),
'Products': Array.isArray(productsSummary) ? productsSummary.map(p => `${p.name} (${p.quantity})`).join(', ') : '-'
});
});
doc.autoTable({
startY: y,
head: [['Order ID', 'Date', 'Total Sales', 'Products']],
body: reportContent.map(item => Object.values(item))
});
break;
case 'services':
reportData.forEach(item => {
reportContent.push({
'ID': item.id,
'Name': item.name,
'Phone': item.phone,
'Device': item.deviceType,
'Issue': item.issue,
'Date': new Date(item.createdAt).toLocaleDateString(),
});
});
doc.autoTable({
startY: y,
head: [['ID', 'Name', 'Phone', 'Device', 'Issue', 'Date']],
body: reportContent.map(item => Object.values(item))
});
break;
default:
doc.text(`Report type not found.`, 20, y + 10);
break;
}
}
doc.save(`${reportType}-report-${new Date().toLocaleDateString()}.pdf`);
showMessage("Success", "Report downloaded successfully!");
} catch (error) {
console.error("Error generating report:", error);
showMessage("Error!", "Could not generate report. Check the server.");
}
}
function generateReviewsReport(doc, data, startY) {
let y = startY;
const margin = 20;
const lineHeight = 7;
const boxPadding = 5;
const boxWidth = 170;
data.forEach(review => {
const lines = [
`ID: ${review.ID}`,
`Product: ${review.Product}`,
`User: ${review.User}`,
`Rating: ${review.Rating}`,
`Comment: ${review.Comment}`,
`Date: ${review.Date}`
];
const boxHeight = (lines.length * lineHeight) + (2 * boxPadding);
if (y + boxHeight + margin > doc.internal.pageSize.height) {
doc.addPage();
y = margin;
}
doc.rect(margin, y, boxWidth, boxHeight);
let textY = y + boxPadding + (lineHeight / 2);
lines.forEach(line => {
doc.text(line, margin + boxPadding, textY);
textY += lineHeight;
});
y += boxHeight + 10;
});
}
function setupReportsPage() {
$$('#reportsPage [data-report-type]').forEach(button => {
button.addEventListener('click', () => {
const reportType = button.dataset.reportType;
downloadReport(reportType);
});
});
}
let allAdvertisements = [];
async function fetchAdvertisements() {
try {
const response = await fetch("http://localhost:5000/api/advertisements");
if (!response.ok) throw new Error('Failed to fetch advertisements.');
allAdvertisements = await response.json();
return allAdvertisements;
} catch (error) {
console.error("❌ Error fetching advertisements:", error);
showMessage("Ad Error", "Failed to fetch advertisement data from the server.");
return [];
}
}
async function renderCurrentAdvertisementsTable() {
const tableBody = $('#currentAdvertisementsTableBody');
const listContainer = $('#advertisementsList'); 
const adCount = $('#adCount'); 
if (!tableBody) return;
tableBody.innerHTML = `<tr><td colspan="3" class="empty">Loading advertisements...</td></tr>`;
await fetchAdvertisements();
if (adCount) adCount.textContent = allAdvertisements.length;
if (listContainer) listContainer.innerHTML = '';
if (allAdvertisements.length === 0) {
tableBody.innerHTML = `<tr><td colspan="3" class="empty">No advertisements uploaded.</td></tr>`;
if (listContainer) listContainer.innerHTML = '<p class="empty-state">No advertisements uploaded.</p>';
return;
}
tableBody.innerHTML = '';
allAdvertisements.forEach(ad => {
const row = document.createElement('tr');
row.innerHTML = `
<td><img src="${ad.image_url}" alt="Ad Image" style="width: 120px; height: 60px; object-fit: cover; border-radius: 4px;"></td>
<td><span class="muted-text">${ad.image_url}</span></td>
<td>
<button class="btn small danger delete-ad-btn" data-id="${ad.id}">Remove</button>
</td>
`;
tableBody.appendChild(row);
if (listContainer) {
const listItem = document.createElement('li');
listItem.className = 'list-item ad-list-item';
listItem.innerHTML = `
<img src="${ad.image_url}" alt="Advertisement Image" class="ad-image-preview">
<div class="ad-details">
<span class="muted">${ad.image_url}</span>
</div>
<button class="btn small danger delete-ad-btn" data-id="${ad.id}">Delete</button>
`;
listContainer.appendChild(listItem);
}
});
$$('.delete-ad-btn').forEach(btn => {
btn.addEventListener('click', handleDeleteAdvertisement);
});
}
async function handleAdvertisementFormSubmit(event) {
event.preventDefault();
const imageFile = $('#adImage').files[0];
if (!imageFile) {
showMessage("Error", "Please select an image file.");
return;
}
const formData = new FormData();
formData.append('image', imageFile);
formData.append('description', 'Default Ad'); 
const submitBtn = event.target.querySelector('button[type="submit"]');
submitBtn.disabled = true;
try {
const response = await fetch('http://localhost:5000/api/advertisements', {
method: 'POST',
body: formData,
});
if (response.ok) {
showMessage("Success", "Advertisement uploaded successfully!");
$('#advertisementForm').reset();
await renderCurrentAdvertisementsTable();
} else {
const errorResult = await response.json();
showMessage("Error!", "Upload failed: " + (errorResult.error || 'Unknown Error'));
}
} catch (error) {
console.error("Error uploading advertisement:", error);
showMessage("Error!", "An unexpected error occurred during upload.");
} finally {
submitBtn.disabled = false;
}
}
async function handleDeleteAdvertisement(event) {
const id = event.currentTarget.dataset.id;
if (!confirm("Are you sure you want to remove this advertisement? This cannot be undone.")) {
return;
}
try {
const response = await fetch(`http://localhost:5000/api/advertisements/${id}`, {
method: 'DELETE',
});
if (response.ok) {
showMessage("Success", "Advertisement removed successfully!");
await renderCurrentAdvertisementsTable();
} else {
const errorResult = await response.json();
showMessage("Error!", "Removal failed: " + (errorResult.error || 'Unknown Error'));
}
} catch (error) {
console.error("Error deleting advertisement:", error);
showMessage("Error!", "An unexpected error occurred during removal.");
}
}
async function openAdvertisementModal() {
const modal = $('#advertisementModal');
if (modal) {
await renderCurrentAdvertisementsTable(); 
modal.classList.remove('hidden');
document.body.classList.add('no-scroll');
}
}
function closeAdvertisementModal() {
const modal = $('#advertisementModal');
if (modal) {
modal.classList.add('hidden');
document.body.classList.remove('no-scroll');
$('#advertisementForm').reset();
renderCurrentAdvertisementsTable(); 
}
}
function setupAdvertisementModalListeners() {
const openBtn = $('#openAdvertisementModalBtn');
const closeBtn = $('#closeAdvertisementModal');
const form = $('#advertisementForm');
if(openBtn) openBtn.addEventListener('click', openAdvertisementModal);
if(closeBtn) closeBtn.addEventListener('click', closeAdvertisementModal);
if(form) form.addEventListener('submit', handleAdvertisementFormSubmit);
}
function setupAdvertisementPage() {
renderCurrentAdvertisementsTable();
}
function setupSearchListeners() {
const productsSearch = $('#productsPageSearch');
const clearProductsSearch = $('#clearProductsPageSearch');
if (productsSearch) {
productsSearch.addEventListener('input', () => {
const searchQuery = productsSearch.value;
renderProducts(getCurrentProductFilter(), searchQuery);
});
}
if (clearProductsSearch) {
clearProductsSearch.addEventListener('click', () => {
if (productsSearch) productsSearch.value = '';
const currentCategoryFilter = getCurrentProductFilter(); 
renderProducts(currentCategoryFilter, '');
});
}
const ordersSearch = $('#ordersPageSearch');
const clearOrdersSearch = $('#clearOrdersSearch');
if (ordersSearch) {
ordersSearch.addEventListener('input', () => {
const searchQuery = ordersSearch.value;
const dateFilterString = getCurrentOrderDateFilter();
renderOrders(getCurrentStatusFilter(), searchQuery, dateFilterString);
});
}
if (clearOrdersSearch) {
clearOrdersSearch.addEventListener('click', () => {
if (ordersSearch) ordersSearch.value = '';
const dateFilterString = getCurrentOrderDateFilter();
renderOrders(getCurrentStatusFilter(), '', dateFilterString); 
});
}
const customersSearch = $('#customersPageSearch');
const clearCustomersSearch = $('#clearCustomersSearch');
if (customersSearch) {
customersSearch.addEventListener('input', () => {
const searchQuery = customersSearch.value;
renderCustomers(searchQuery);
});
}
if (clearCustomersSearch) {
clearCustomersSearch.addEventListener('click', () => {
if (customersSearch) customersSearch.value = '';
renderCustomers('');
});
}
const servicesSearch = $('#servicesPageSearch');
const clearServicesSearch = $('#clearServicesSearch');
if (servicesSearch) {
servicesSearch.addEventListener('input', () => {
const searchQuery = servicesSearch.value;
renderServices(searchQuery);
});
}
if (clearServicesSearch) {
clearServicesSearch.addEventListener('click', () => {
if (servicesSearch) servicesSearch.value = '';
renderServices('');
});
}
}
function initializeAdminPanel() {
protectAdminRoute();
setupNavigation();
setupLogout();
setupProductModal();
setupProductFilters(); 
setupOrderFilters(); 
setupOrderDateFilterInput(); 
setupReportsPage(); 
setupAdvertisementModalListeners(); 
setupAdvertisementPage(); 
setupSearchListeners(); 
setupMobileToggle();
updateDateTime();
setInterval(updateDateTime, 1000);
fetchAllProducts().then(() => {
loadDashboardStats();
renderOrders('All', '', ''); 
renderProducts('All', '', ''); 
renderCustomers(''); 
renderServices(''); 
const pageFromHash = (window.location.hash || '').replace('#', '');
if (pageFromHash) {
const navButton = $(`.nav-link[data-target=\"${pageFromHash}\"]`);
if (navButton) navButton.click();
} else {
const dashboardBtn = $('.nav-link.active');
if(dashboardBtn) dashboardBtn.click();
}
}).catch(error => {
console.error("Initial Product Load Failed (Critical):", error);
showMessage("Critical Error", "Failed to load product data. Dashboard may be incomplete. Check API connection.");
loadDashboardStats();
});
}
window.addEventListener('DOMContentLoaded', initializeAdminPanel);
})();