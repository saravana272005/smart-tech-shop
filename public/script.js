let PRODUCTS=[];
const CATEGORY_LABELS={all:"All Products",mobiles:"Mobiles",laptops:"Laptops",tvs:"Televisions",accessories:"Accessories",smartwatch:"Smart Watch",seconds:"Second-hand"};
let USERS=[];
let allOrders=[];
let USER_RATINGS={};
let CART=[];
let WISHLIST=[];
let HIDDEN_ORDER_IDS=[]; // NEW: Array to store order IDs the user wants to hide locally
let CURRENT_STATE={category:"all",brand:null,minPrice:null,maxPrice:null,searchTerm:null};
let modalState={product:null,currentImageIndex:0,selectedVariantIndex:0};
let currentlyOpenRatingPopover=null;
let REVIEWS={};
let countdownInterval=null;
let ADVERTISEMENTS = []; // NEW: Global variable for advertisements
const Rs=n=>`₹${Number(n).toLocaleString("en-IN")}`;
const $=sel=>document.querySelector(sel);
const $$=sel=>document.querySelectorAll(sel);
const chevronDownSVG=`<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/></svg>`;
const arrowRightSVG=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1 8a.5.5 0 0 1 .5-.5h11.793l-3.147-3.146a.5.5 0 0 1 .708-.708l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 0 1-.708-.708L13.293 8.5H1.5A.5.5 0 0 1 1 8z"/></svg>`;
const chevronRightSVG=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>`;


function injectCSS(){
    const style=document.createElement('style');
    style.innerHTML=`
    /* === END ORDER PAGE PRINT STYLES === */
    `;
    document.head.appendChild(style);
}

// NEW FUNCTION: Fetch Advertisements
async function fetchAdvertisements(){
    try{
        // 🚩 FIX: Removed localhost, using relative path
        const response = await fetch("/api/advertisements");
        if(!response.ok){
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        ADVERTISEMENTS = await response.json();
    }catch(error){
        console.error("Could not fetch advertisements:", error);
        // Fallback to hardcoded array if API fails, ensuring the site doesn't crash
        ADVERTISEMENTS = [
             {image_url: "https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?q=80&w=1964&auto=format&fit:crop", description: "Default Ad 1"},
             {image_url: "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?q=80&w=2070&auto=format&fit:crop", description: "Default Ad 2"},
             {image_url: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=2070&auto=format&fit:crop", description: "Default Ad 3"}
        ];
    }
}

async function fetchProducts(){
    try{
        // 🚩 FIX: Removed localhost, using relative path
        const response=await fetch("/api/products");
        if(!response.ok){
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const productsFromServer=await response.json();
        PRODUCTS=productsFromServer.map(p=>({...p,id:p.id.toString(),title:p.name,specs:typeof p.specs==='string'?JSON.parse(p.specs):p.specs||{},images:typeof p.images==='string'?JSON.parse(p.images):(p.images||[]),rating:p.rating||4.5,reviews:p.reviews||0,ratingBreakdown:typeof p.ratingBreakdown==='string'?JSON.parse(p.ratingBreakdown):p.ratingBreakdown||{5:0,4:0,3:0,2:0,1:0},variants:Array.isArray(p.variants)?p.variants:typeof p.variants==='string'?JSON.parse(p.variants):(p.variants||[]),discount_end_date:p.discount_end_date?new Date(p.discount_end_date):null}));
    }catch(error){
        console.error("Could not fetch products:",error);
        showToast("Failed to load products from the server.",true);
    }
}

function saveData(){
    localStorage.setItem('shop_users',JSON.stringify(USERS));
    localStorage.setItem('shop_user_ratings',JSON.stringify(USER_RATINGS));
    localStorage.setItem('shop_all_orders',JSON.stringify(allOrders));
    localStorage.setItem('shop_reviews',JSON.stringify(REVIEWS));
}

function loadData(){
    USERS=JSON.parse(localStorage.getItem('shop_users')||'[]');
    USER_RATINGS=JSON.parse(localStorage.getItem('shop_user_ratings')||'{}');
    allOrders=JSON.parse(localStorage.getItem('shop_all_orders')||'[]');
    REVIEWS=JSON.parse(localStorage.getItem('shop_reviews')||'{}');
    loadCartFromStorage();
    loadWishlistFromStorage();
    loadHiddenOrders(); // NEW: Load hidden orders
}

function showToast(message,isError=false){
    const existingToast=$('.custom-toast');
    if(existingToast)existingToast.remove();
    const toast=document.createElement('div');
    toast.className=`custom-toast ${isError?'error':''}`;
    toast.textContent=message;
    const headerHeight=$('#pageHeader')?.offsetHeight||0;
    toast.style.top=`${headerHeight+20}px`;
    document.body.appendChild(toast);
    setTimeout(()=>toast.classList.add('show'),10);
    setTimeout(()=>{
        toast.classList.remove('show');
        setTimeout(()=>toast.remove(),2500);
    },2500);
}

function createConfirmationModal(){
    if($('#confirmationModalOverlay'))return;
    document.body.insertAdjacentHTML('beforeend',`<div id="confirmationModalOverlay" class="modal-overlay"><div class="confirmation-modal-content"><h4 id="confirmationMessage">Are you sure?</h4><p id="confirmationSubMessage" style="font-size: 14px; color: #666; margin-top: -10px; margin-bottom: 20px;"></p><div class="confirmation-buttons"><button id="confirmYesBtn" class="confirm-btn yes">Yes</button><button id="confirmNoBtn" class="confirm-btn no">No</button></div></div></div>`);
    $('#confirmNoBtn').onclick=closeConfirmationModal;
    $('#confirmationModalOverlay').addEventListener('click',closeConfirmationModal);
    $('#confirmationModalOverlay .confirmation-modal-content').addEventListener('click',e=>e.stopPropagation());
}

function showConfirmation(message,onConfirm,subMessage=""){
    createConfirmationModal();
    $('#confirmationMessage').textContent=message;
    $('#confirmationSubMessage').textContent=subMessage;
    const oldYesBtn=$('#confirmYesBtn');
    const newYesBtn=oldYesBtn.cloneNode(true);
    oldYesBtn.parentNode.replaceChild(newYesBtn,oldYesBtn);
    newYesBtn.onclick=()=>{
        onConfirm();
        closeConfirmationModal();
    };
    document.body.classList.add('no-scroll');
    $('#confirmationModalOverlay').style.display='flex';
}

function closeConfirmationModal(){
    document.body.classList.remove('no-scroll');
    if($('#confirmationModalOverlay')){
        $('#confirmationModalOverlay').style.display='none';
    }
}

// --- home ---
function initHomePage(){
    const carousel=$("#hero-carousel");
    const indicators=$("#carousel-indicators");
    
    // Use fetched advertisements data
    const slides = ADVERTISEMENTS.map(ad => ad.image_url);
    
    if(!carousel || slides.length === 0) {
        if (carousel) carousel.innerHTML = '<img src="https://placehold.co/1200x300/e0e0e0/757575?text=No+Ads" alt="Default Image">';
        return;
    }
    
    const slideCount = slides.length;
    
    // Set CSS variable for slide count on the carousel wrapper for use in CSS calc()
    const wrapper = $('#hero-carousel').closest('.hero-carousel-wrapper');
    if (wrapper) {
         wrapper.style.setProperty('--slide-count', slideCount);
    }
    
    let currentSlide=0;
    
    // MODIFICATION START: Use display: flex and set the carousel width based on the number of slides
    // Ensure the total width is (N * 100%) and images inside are (100% / N)
    carousel.style.cssText = `width: ${slideCount * 100}%; display: flex; transition: transform 0.5s ease-in-out;`;
    
    // MODIFICATION: Added 'carousel-img' class for uniform sizing
    carousel.innerHTML=slides.map(src=>`<img src="${src}" class="carousel-img" alt="Carousel image">`).join('');
    // MODIFICATION END

    
    function showSlide(index){
        currentSlide=(index+slideCount)%slideCount;
        // CRUCIAL FIX: Translate the carousel container by a percentage equivalent to the current slide index.
        // If 2 slides: 0% (slide 1), -50% (slide 2). 
        // If 3 slides: 0% (slide 1), -33.33% (slide 2), -66.66% (slide 3).
        carousel.style.transform=`translateX(${-currentSlide*(100/slideCount)}%)`;
        if(indicators){
            indicators.innerHTML=slides.map((_,i)=>`<span class="indicator-dot ${i===currentSlide?'active':''}" data-index="${i}"></span>`).join('');
            $$('#carousel-indicators .indicator-dot').forEach(dot=>dot.onclick=()=>showSlide(parseInt(dot.dataset.index)));
        }
    }
    
    // Ensure navigation functions use the dynamic slide count
    window.prevSlide=()=>showSlide(currentSlide-1);
    window.nextSlide=()=>showSlide(currentSlide+1);
    
    showSlide(0);
    // Only set interval if there's more than one slide
    if (slides.length > 1) {
        setInterval(()=>showSlide(currentSlide+1),5000);
    }
}

function latestProductCard(p){
    const card=document.createElement("div");
    card.className="latest-product-card";
    const mainImage=(p.images&&p.images.length>0)?p.images[0]:'https://placehold.co/400x300/e0e0e0/757575?text=No+Image';
    const displayPrice=(p.variants&&p.variants.length>0)?p.variants[0].price:p.price;
    const mrpPrice=(p.variants&&p.variants.length>0)?p.variants[0].mrp_price:p.mrp_price;
    const priceHTML=renderPriceHTML(displayPrice,mrpPrice);
    const isOutOfStock=p.variants&&p.variants.length>0?p.variants[0].stock===0:p.stock===0;
    const outOfStockOverlay=isOutOfStock?`<div class="out-of-stock-overlay"><span>Out of Stock</span></div>`:'';
    card.innerHTML=`<div class="product-image-container"><img src="${mainImage}" class="latest-product-img"/>${outOfStockOverlay}</div><div class="latest-product-content"><h4 class="latest-product-title">${p.title}</h4><div class="product-meta"><div class="price-row">${priceHTML}</div></div></div>`;
    return card;
}

function displayLatestProducts(){
    const latestProductsGrid=$('#latestProductsGrid');
    if(!latestProductsGrid)return;
    const latestProducts=PRODUCTS.slice(-4).reverse();
    if(latestProducts.length===0){
        latestProductsGrid.innerHTML=`<p style="text-align: center; width: 100%; margin-top: 20px;">No products found.</p>`;
        return;
    }
    latestProductsGrid.innerHTML='';
    latestProducts.forEach(p=>{
        const card=latestProductCard(p);
        latestProductsGrid.appendChild(card);
    });
}
// --- home ---
function initShopPage(){
    buildCategoryPanel();
    
    // Find the main filter bar container (should exist in HTML based on CSS)
    const shopFilterBar=$('.shop-filter-bar');
    
    // **MODIFIED: Shop Filter Bar Logic**
    if(shopFilterBar){
        const searchInput=$('#headerSearchInput'); // Using the search input inside the shop-page-search-container (which is inside shop-filter-bar)
        const searchBtn=shopFilterBar.querySelector('.search-submit-button');

        // **1. Handle Search**
        if(searchBtn && searchInput){
             searchBtn.addEventListener('click',(e)=>{
                 e.preventDefault(); 
                 CURRENT_STATE.searchTerm=searchInput.value.trim();
                 renderFiltered();
             });
             searchInput.addEventListener('keydown',(e)=>{
                 if(e.key==='Enter'){
                     e.preventDefault();
                     CURRENT_STATE.searchTerm=searchInput.value.trim();
                     renderFiltered();
                 }
             });
        }
        
        // Removed old Brand/Filter Toggle logic as it is now part of the Category Panel
    }
    
    // **2. Initial Load and Query**
    // REMOVED GRID CLASS ADDITION: $('#productsGrid').classList.add('layout-5-col');
    const urlParams=new URLSearchParams(window.location.search);
    const searchQuery=urlParams.get('q');
    
    if(searchQuery){
        CURRENT_STATE.searchTerm=searchQuery;
        $("#productsDisplayTitle").textContent=`Search results for "${searchQuery}"`;
        const mainSearchInput=$('#headerSearchInput'); // Ensure this ID targets the visible search bar
        if(mainSearchInput)mainSearchInput.value=searchQuery;
    } else {
        $("#productsDisplayTitle").textContent=CATEGORY_LABELS[CURRENT_STATE.category];
    }
    
    // **3. Initial Brand Filter Population/Hiding - No longer needed, logic moved to panel**
    renderFiltered();
}

function getStarRatingHTML(rating){
    let html='';
    const numRating=parseFloat(rating);
    const fullStars=Math.floor(numRating);
    const hasHalfStar=(numRating-fullStars)>=0.5;
    for(let i=0;i<fullStars;i++){
        html+='★';
    }
    if(hasHalfStar){
        html+='½';
    }
    const emptyStars=5-(fullStars+(hasHalfStar?1:0));
    for(let i=0;i<emptyStars;i++){
        html+='☆';
    }
    return`<span class="star-rating">${html}</span>`;
}

function renderPriceHTML(price,mrp_price){
    let html='';
    if(mrp_price>0&&price>0&&price<mrp_price){
        const discount=Math.round(((mrp_price-price)/mrp_price)*100);
        html+=`<span class="strikethrough-price-mrp">MRP ${Rs(mrp_price)}</span><br><span class="discount-price-new">${Rs(price)}</span> <span class="discount-badge">${discount}% off</span>`;
    }else if(mrp_price>0){
        // This case assumes if there's an MRP, we show it, even if no discount is present in this view
        html+=`<span class="discount-price-new">${Rs(mrp_price)}</span>`; 
    }else if(price>0){
        html+=`<span class="regular-price">${Rs(price)}</span>`;
    }else{
        html+=`<span class="regular-price">Price not available</span>`;
    }
    return html;
}

// Function to get the stock quantity for display on the main page
function getDisplayStock(p) {
    // For variant products (mobiles, laptops, seconds), use the stock of the first variant for the main card display.
    if (['mobiles', 'laptops', 'seconds'].includes(p.category) && p.variants && p.variants.length > 0) {
        return parseInt(p.variants[0].stock) || 0;
    }
    // Use the main product stock for non-variant products
    return parseInt(p.stock) || 0;
}

// Function to generate the Low Stock Alert HTML
function getLowStockAlertHTML(stock) {
    // NOTE: CSS styles for these classes must be provided externally now.
    if (stock > 0 && stock <= 5) {
        return `<span class="low-stock-alert">Low Stock: <span class="low-stock-count">${stock}</span> left!</span>`;
    }
    return '';
}

function productCard(p){
    const card=document.createElement("div");
    card.className="product-card";
    card.dataset.productId=p.id;
    const isWishlisted=isProductInWishlist(p.id);
    
    // --- Stock Check for Main Card (Uses logic in getDisplayStock) ---
    const displayStock = getDisplayStock(p);
    const isOutOfStock = displayStock === 0;
    // NOTE: .out-of-stock-overlay CSS must be provided externally.
    const outOfStockOverlay = isOutOfStock ? `<div class="out-of-stock-overlay"><span>Out of Stock</span></div>` : '';
    const lowStockAlertHTML = isOutOfStock ? '' : getLowStockAlertHTML(displayStock);
    // -----------------------------------------------------------------

    let displayPrice=p.price;
    let mrpPrice=p.mrp_price;
    let discountEndDate=p.discount_end_date;
    
    // Set initial display price for variant products using the first variant
    if(['mobiles', 'laptops', 'seconds'].includes(p.category) && p.variants && p.variants.length > 0){
        const selectedVariant=p.variants[0];
        displayPrice=selectedVariant.price;
        mrpPrice=selectedVariant.mrp_price;
        discountEndDate=selectedVariant.discount_end_date;
    }
    
    const now=new Date();
    const isDiscountExpired=discountEndDate&&now>new Date(discountEndDate);
    if(isDiscountExpired){
        displayPrice=null;
        discountEndDate=null;
    }
    
    const ratingHtml=p.rating?`<div class="product-rating" data-product-id="${p.id}">${getStarRatingHTML(p.rating)}<div class="rating-info-wrapper" style="cursor: default;"><span class="rating-count">${p.rating}</span><span class="rating-count">(${p.reviews})</span><button class="rating-details-btn" onclick="showRatingPopover(PRODUCTS.find(pr => pr.id === '${p.id}'), this)">${chevronDownSVG}</button></div><div class="rating-popover"><h4>Rating Breakdown (${p.reviews} Reviews)</h4>${[5,4,3,2,1].map(i=>{const count=p.ratingBreakdown[i]||0;const percentage=p.reviews>0?(count/p.reviews)*100:0;return`<div class="rating-breakdown-row"><span>${i} ★</span><div class="rating-bar-container"><div class="rating-bar" style="width: ${percentage}%;"></div></div><span>${count}</span></div>`;}).join('')}</div></div>`:'<span class="no-rating">No reviews</span>';
    const viewReviewsBtn=p.reviews>0?`<button class="view-reviews-btn" onclick="openAllReviewsModal('${p.id}')">View Reviews${arrowRightSVG}</button>`:'';
    
    // MODIFIED: Insert lowStockAlertHTML after price row
    card.innerHTML=`<div class="product-image-container"><button class="wishlist-btn ${isWishlisted?'wishlisted':''}" onclick="toggleWishlist(event, '${p.id}')"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></button><img src="${(p.images&&p.images.length>0)?p.images[0]:'https://placehold.co/400x300/e0e0e0/757575?text=No+Image'}" alt="${p.title}" class="product-img"/>${outOfStockOverlay}</div><div class="product-card-content"><div class="product-title">${p.title}</div>${ratingHtml}${viewReviewsBtn}<div class="product-meta"><div class="price-row">${renderPriceHTML(displayPrice,mrpPrice)}</div>${lowStockAlertHTML}<button class="view-details-btn">View Details</button></div></div>`;
    // REMOVED: The 3-bar button from product card is removed by simply not adding it to the card innerHTML.
    card.querySelector(".view-details-btn").onclick=()=>openDetails(p);
    return card;
}

function getProductDisplayPrice(p){
    // This function is generally not used for display, but for clarity, it should look at the first variant for variant products.
    if (['mobiles', 'laptops', 'seconds'].includes(p.category) && p.variants && p.variants.length > 0) {
         return p.variants[0].price;
    }
    return p.price;
}

function renderFiltered(){
    const grid=$("#productsGrid");
    if(!grid)return;
    grid.innerHTML="";
    let filtered=PRODUCTS;
    if(CURRENT_STATE.category&&CURRENT_STATE.category!=="all"){
        filtered=filtered.filter(p=>p.category===CURRENT_STATE.category);
    }
    if(CURRENT_STATE.brand&&CURRENT_STATE.brand!=="all"){
        filtered=filtered.filter(p=>p.brand===CURRENT_STATE.brand);
    }
    if(CURRENT_STATE.searchTerm){
        const searchTermLower=CURRENT_STATE.searchTerm.toLowerCase();
        filtered=filtered.filter(p=>{
            const titleMatch=p.title.toLowerCase().includes(searchTermLower);
            const brandMatch=p.brand&&p.brand.toLowerCase().includes(searchTermLower);
            return titleMatch||brandMatch;
        });
    }
    if(filtered.length===0){
        grid.innerHTML=`<p style="text-align: center; width: 100%; margin-top: 20px;">No products found.</p>`;
        return;
    }
    const wrap=document.createElement("div");
    // NOTE: The "grid" class styles must be provided externally.
    wrap.className="grid";
    filtered.forEach(p=>wrap.appendChild(productCard(p)));
    grid.appendChild(wrap);
}

// MODIFIED: buildCategoryPanel now handles both Category and Brand sliding views
function buildCategoryPanel(){
    if($('#category-panel-modal'))return;

    // Outer structure with header and sliding content wrapper
    // NOTE: The inline CSS styles and class names here require external CSS for proper layout and appearance.
    document.body.insertAdjacentHTML('beforeend',
        `<div id="category-panel-modal">
            <div class="category-panel-content">
                <div class="panel-header">
                    <button class="back-to-categories" id="backToCategoriesBtn" style="display: none;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/></svg>
                        Main Menu
                    </button>
                    <h4 id="panelTitle">All Categories</h4>
                    <button class="modal-close-button" onclick="closeCategoryPanel()">&times;</button>
                </div>
                <div id="panelContentWrapper">
                    <div id="categoryList"></div>
                    <div id="brandListPanel">
                        </div>
                </div>
            </div>
        </div>`);

    const categoryList=$('#categoryList');
    const brandListPanel=$('#brandListPanel');
    const backToCategoriesBtn=$('#backToCategoriesBtn');
    
    // 1. Populate Category List
    Object.entries(CATEGORY_LABELS).forEach(([cat, label])=>{
        const button=document.createElement('button');
        // NOTE: category-button and active class styles must be provided externally.
        button.className=`category-button ${cat==='all'?'active':''}`;
        button.dataset.cat=cat;
        
        // Add chevron right only if it's not 'All Products'
        const hasSubCategories = cat !== 'all';
        button.innerHTML=`<span>${label}</span> ${hasSubCategories ? chevronRightSVG : ''}`;
        categoryList.appendChild(button);

        button.onclick=()=>{
            // If 'All Products' is clicked, filter and close panel immediately
            if (cat === 'all') {
                setCurrentFilter(cat, null, label);
                closeCategoryPanel();
                return;
            }

            // If a specific category is clicked, show the Brand List panel
            showBrandList(cat, label);
        };
    });
    
    // 2. Set event for Back button
    backToCategoriesBtn.onclick=showCategoryList;

    // 3. Brand selection handler
    brandListPanel.addEventListener('click', (e) => {
        const brandButton = e.target.closest('.brand-button');
        if (brandButton) {
            const brand = brandButton.dataset.brand;
            const category = brandButton.dataset.category;
            // Use the category label, not the brand name, for the final title if 'all' brands selected
            const title = brand === 'all' ? CATEGORY_LABELS[category] : brand; 
            
            setCurrentFilter(category, brand, title);
            closeCategoryPanel();
        }
    });
}

// New function to handle category and brand selection
function setCurrentFilter(category, brand, title) {
    $$('.category-button').forEach(btn => btn.classList.remove('active'));
    $(`[data-cat="${category}"]`)?.classList.add('active');
    
    CURRENT_STATE.category = category;
    CURRENT_STATE.brand = brand;
    CURRENT_STATE.searchTerm = null;
    
    $("#productsDisplayTitle").textContent = title;
    $('#headerSearchInput').value = '';
    renderFiltered();
}

// New function to show brands for a selected category
function showBrandList(category, categoryLabel) {
    const brands = [...new Set(PRODUCTS.filter(p => p.category === category).map(p => p.brand))].sort();
    const brandListPanel = $('#brandListPanel');
    
    // NOTE: brand-list-header and brand-list-subtitle CSS must be provided externally.
    let brandsHtml = `<div class="brand-list-header">${categoryLabel}</div>`;
    brandsHtml += `<div class="brand-list-subtitle">Brands</div>`; // Add centered "Brands" subtitle

    // Option to view all products in that category
    brandsHtml += `<button class="brand-button" data-brand="all" data-category="${category}"><span>All ${categoryLabel}</span></button>`;

    // List specific brands
    brands.forEach(b => {
        if (b) {
            brandsHtml += `<button class="brand-button" data-brand="${b}" data-category="${category}"><span>${b}</span></button>`;
        }
    });

    brandListPanel.innerHTML = brandsHtml;
    
    // Slide to the brand panel (move content wrapper 50% to the left)
    $('#panelContentWrapper').style.transform = 'translateX(-50%)';
    // 2. Clear the main header title when moving to the brand list, as the title is now inside the panel
    $('#panelTitle').textContent = ''; 
    $('#backToCategoriesBtn').style.display = 'flex';
}

// New function to return to main category list
function showCategoryList() {
    $('#panelContentWrapper').style.transform = 'translateX(0)';
    $('#panelTitle').textContent = 'All Categories';
    $('#backToCategoriesBtn').style.display = 'none';
}


function openCategoryPanel(){
    document.body.classList.add('no-scroll');
    const panel=$('#category-panel-modal');
    if(panel){
        panel.classList.add('active');
        // REMOVED GRID CLASS MODIFICATION: $('#productsSection').classList.add('shifted');
        // REMOVED GRID CLASS MODIFICATION: $('#productsGrid').classList.remove('layout-5-col');
        // REMOVED GRID CLASS MODIFICATION: $('#productsGrid').classList.add('layout-4-col');
        
        // Reset to category list view every time it opens
        showCategoryList();
    }
}

function closeCategoryPanel(){
    document.body.classList.remove('no-scroll');
    const panel=$('#category-panel-modal');
    if(panel){
        panel.classList.remove('active');
        // REMOVED GRID CLASS MODIFICATION: $('#productsSection').classList.remove('shifted');
        // REMOVED GRID CLASS MODIFICATION: $('#productsGrid').classList.remove('layout-4-col');
        // REMOVED GRID CLASS MODIFICATION: $('#productsGrid').classList.add('layout-5-col');
    }
}

function openDetails(p){
    document.body.classList.add('no-scroll');
    modalState={product:p,currentImageIndex:0,selectedVariantIndex:0};
    const overlay=$("#detailsOverlay");
    if(!overlay)return;
    overlay.hidden=false;
    const isWishlisted=isProductInWishlist(p.id);
    
    // --- Initial setup (always use index 0 for initial view) ---
    const isVariantProduct = ['mobiles', 'laptops', 'seconds'].includes(p.category) && p.variants && p.variants.length > 0;
    
    let initialVariant=isVariantProduct?p.variants[0]:null;
    let initialPrice=initialVariant?initialVariant.price:p.price;
    let initialMRPPrice=initialVariant?initialVariant.mrp_price:p.mrp_price;
    let initialDiscountEndDate=initialVariant?initialVariant.discount_end_date:p.discount_end_date;
    let initialStock=initialVariant?initialVariant.stock:p.stock;
    // -----------------------------------------------------------
    
    // --- Stock Check for Modal ---
    const lowStockAlertHTML = getLowStockAlertHTML(initialStock);
    // -----------------------------

    const mainImage=(p.images&&p.images.length>0)?p.images[0]:'https://placehold.co/400x300/e0e0e0/757575?text=No+Image';
    let featuresHTML='';
    if(p.specs){
        const specsObject=typeof p.specs==='string'?JSON.parse(p.specs):p.specs;
        featuresHTML=Object.entries(specsObject).map(([key,value])=>`<li><b>${key.charAt(0).toUpperCase()+key.slice(1)}:</b> ${value}</li>`).join("");
    }
    const ratingHtml=p.rating?`<div class="product-rating" data-product-id="${p.id}">${getStarRatingHTML(p.rating)}<div class="rating-info-wrapper" style="cursor: default;"><span class="rating-count">${p.rating}</span><span class="rating-count">(${p.reviews})</span><button class="rating-details-btn" onclick="showRatingPopover(PRODUCTS.find(pr => pr.id === '${p.id}'), this)">${chevronDownSVG}</button></div><div class="rating-popover" id="detailsRatingPopover"><h4>Rating Breakdown (${p.reviews} Reviews)</h4>${[5,4,3,2,1].map(i=>{const count=p.ratingBreakdown[i]||0;const percentage=p.reviews>0?(count/p.reviews)*100:0;return`<div class="rating-breakdown-row"><span>${i} ★</span><div class="rating-bar-container"><div class="rating-bar" style="width: ${percentage}%;"></div></div><span>${count}</span></div>`;}).join('')}</div></div>`:'<span class="no-rating">No reviews</span>';
    let variantsHTML='';
    if(isVariantProduct){
        variantsHTML=`<div class="variant-selector"><h4>Select a Variant:</h4><div id="variantButtons">${p.variants.map((v,i)=>{
            const stock = parseInt(v.stock) || 0;
            const isOutOfStock = stock === 0;
            // NOTE: disabled and low-stock-variant class styles must be provided externally.
            const disabledClass=isOutOfStock?'disabled':'';
            const lowStockClass = (stock > 0 && stock <= 5) ? 'low-stock-variant' : '';
            return`<button class="variant-btn ${i===0?'active':''} ${disabledClass} ${lowStockClass}" data-stock="${stock}" onclick="selectVariant(event, ${i})">${v.specName}</button>`
        }).join('')}</div></div>`;
    }
    const initialOutOfStock=initialStock===0;
    // NOTE: .out-of-stock-overlay CSS must be provided externally.
    const outOfStockOverlay=initialOutOfStock?`<div class="out-of-stock-overlay"><span>Out of Stock</span></div>`:'';
    
    // MODIFIED: Insert lowStockAlertHTML after details-price-container
    // NOTE: details-card, details-close, details-content-wrapper, details-image-section, details-hero CSS must be provided externally.
    overlay.innerHTML=`<div class="details-card slide-down" style="max-width: 700px; margin: 20px auto; display: flex; flex-direction: column;"><button class="details-close" onclick="closeDetails()">✕</button><div class="details-content-wrapper" style="display: flex; gap: 20px;"><div class="details-image-section"><div class="wishlist-btn-container"><button class="wishlist-btn ${isWishlisted?'wishlisted':''}" onclick="toggleWishlist(event, '${p.id}')"><svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></button></div><div class="details-hero"><img src="${mainImage}" id="mainDetailImg" alt="${p.title}"/><button class="details-nav-btn prev" onclick="navigateDetailImages(event, -1)">❮</button><button class="details-nav-btn next" onclick="navigateDetailImages(event, 1)">❯</button>${outOfStockOverlay}</div><div class="details-thumbs">${(p.images||[]).map((src,i)=>`<img src="${src}" class="${i===0?"active":""}" onclick="switchToDetailImageByIndex(event, ${i})" alt="Thumbnail ${i+1}"/>`).join("")}</div><div class="details-actions"><button class="btn primary" id="modalAddToCartBtn">Add to Cart</button><button class="btn secondary" id="modalBuyNowBtn">Buy Now</button></div></div><div class="details-info"><h3 class="product-title-details">${p.title}</h3><div class="details-price-container">${renderPriceHTML(initialPrice,initialMRPPrice)}</div><div id="modalLowStockAlert">${lowStockAlertHTML}</div><p>${p.description||"Description not available."}</p><div id="countdownTimer" class="countdown-timer"></div><div class="product-rating-and-reviews-container">${ratingHtml}<button class="view-reviews-btn" onclick="openAllReviewsModal('${p.id}');">View Reviews${arrowRightSVG}</button></div>${variantsHTML}<h4>Specifications</h4><ul class="specs">${featuresHTML}</ul></div></div></div>`;
    
    // Re-define selectVariant function for dynamic stock update
    window.selectVariant=(e,variantIndex)=>{
        e.stopPropagation();
        if(!modalState.product||!modalState.product.variants)return;
        modalState.selectedVariantIndex=variantIndex;
        const selectedVariant=modalState.product.variants[variantIndex];
        const discountEndDate=selectedVariant.discount_end_date?new Date(selectedVariant.discount_end_date):null;
        
        // Update price
        $('.details-price-container').innerHTML=renderPriceHTML(selectedVariant.price,selectedVariant.mrp_price);
        
        // Update stock status
        const isVariantOutOfStock=selectedVariant.stock===0;
        const lowStockAlertElement = $('#modalLowStockAlert');
        lowStockAlertElement.innerHTML = getLowStockAlertHTML(selectedVariant.stock);

        const addToCartBtn=$('#modalAddToCartBtn');
        const buyNowBtn=$('#modalBuyNowBtn');
        
        // **MODIFIED: Stock check for Add to Cart / Buy Now buttons (Gray color)**
        if(isVariantOutOfStock){
            addToCartBtn.classList.add('disabled');
            buyNowBtn.classList.add('disabled');
        }else{
            addToCartBtn.classList.remove('disabled');
            buyNowBtn.classList.remove('disabled');
        }
        
        const prevBtn=$('.details-nav-btn.prev');
        const nextBtn=$('.details-nav-btn.next');
        if(isVariantOutOfStock){
            prevBtn.disabled=true;
            nextBtn.disabled=true;
        }else{
            prevBtn.disabled=false;
            nextBtn.disabled=false;
        }
        const outOfStockOverlayElement=$('.details-hero .out-of-stock-overlay');
        if(outOfStockOverlayElement){
            outOfStockOverlayElement.style.display=isVariantOutOfStock?'flex':'none';
        }
        
        // Update images
        if(selectedVariant.images&&selectedVariant.images.length>0){
            $('#mainDetailImg').src=selectedVariant.images[0];
            const thumbnailsContainer=$('.details-thumbs');
            thumbnailsContainer.innerHTML=selectedVariant.images.map((src,i)=>`<img src="${src}" class="${i===0?"active":""}" onclick="switchToDetailImageByIndex(event, ${i}, true)" alt="Thumbnail ${i+1}">`).join("");
            modalState.currentImageIndex=0;
        }else{
            $('#mainDetailImg').src=mainImage;
            const thumbnailsContainer=$('.details-thumbs');
            thumbnailsContainer.innerHTML=p.images.map((src,i)=>`<img src="${src}" class="${i===0?"active":""}" onclick="switchToDetailImageByIndex(event, ${i})" alt="Thumbnail ${i+1}">`).join("");
            modalState.currentImageIndex=0;
        }
        clearInterval(countdownInterval);
        if(discountEndDate){
            startCountdown(discountEndDate);
        }else{
            $('#countdownTimer').style.display='none';
        }
        $$('#variantButtons .variant-btn').forEach((btn,i)=>{
            btn.classList.remove('active');
            if(i===variantIndex){
                btn.classList.add('active');
            }
        });
    };
    
    // Initial setup continues...
    if(initialDiscountEndDate){
        startCountdown(new Date(initialDiscountEndDate));
    }else{
        $('#countdownTimer').style.display='none';
    }
    const isInitialOutOfStock=initialStock===0;
    const addToCartBtn=$('#modalAddToCartBtn');
    const buyNowBtn=$('#modalBuyNowBtn');
    const prevBtn=$('.details-nav-btn.prev');
    const nextBtn=$('.details-nav-btn.next');
    
    // **MODIFIED: Initial stock check for Add to Cart / Buy Now buttons**
    if(isInitialOutOfStock){
        addToCartBtn.classList.add('disabled');
        buyNowBtn.classList.add('disabled');
        prevBtn.disabled=true;
        nextBtn.disabled=true;
    }else{
        addToCartBtn.classList.remove('disabled');
        buyNowBtn.classList.remove('disabled');
        prevBtn.disabled=false;
        nextBtn.disabled=false;
    }
    
    $("#modalAddToCartBtn").onclick=(e)=>{
        e.stopPropagation();
        const productToAdd=modalState.product;
        
        // --- Variant selection for Add to Cart ---
        let selectedVariant = null;
        if(isVariantProduct){
             selectedVariant = productToAdd.variants[modalState.selectedVariantIndex];
        }
        
        if(selectedVariant && selectedVariant.stock === 0 || !isVariantProduct && productToAdd.stock === 0){
            showToast("This item is out of stock.",true);
            return;
        }
        addToCart(productToAdd,selectedVariant);
    };
    $("#modalBuyNowBtn").onclick=(e)=>{
        e.stopPropagation();
        const productToBuy=modalState.product;
        
        // --- Variant selection for Buy Now ---
        let selectedVariant = null;
        if(isVariantProduct){
             selectedVariant = productToBuy.variants[modalState.selectedVariantIndex];
        }
        
        if(selectedVariant && selectedVariant.stock === 0 || !isVariantProduct && productToBuy.stock === 0){
            showToast("This item is out of stock.",true);
            return;
        }
        
        requireLogin(()=>{
            let finalPrice;
            let finalTitle;
            let finalVariantSpecName = null;
            
            if(selectedVariant){
                const isDiscountValid=(selectedVariant.mrp_price>0&&selectedVariant.price>0&&selectedVariant.price<selectedVariant.mrp_price);
                finalPrice=isDiscountValid?selectedVariant.price:(selectedVariant.mrp_price>0?selectedVariant.mrp_price:selectedVariant.price);
                finalTitle=`${productToBuy.title} (${selectedVariant.specName})`;
                finalVariantSpecName = selectedVariant.specName;
            }else{
                const isDiscountValid=(productToBuy.mrp_price>0&&productToBuy.price>0&&productToBuy.price<productToBuy.mrp_price);
                finalPrice=isDiscountValid?productToBuy.price:(productToBuy.mrp_price>0?productToBuy.mrp_price:productToBuy.price);
                finalTitle=productToBuy.title;
            }
            
            const itemToBill={...productToBuy,price:finalPrice,title:finalTitle,qty:1, variantSpecName: finalVariantSpecName};
            const subtotal=itemToBill.price;
            const gst=subtotal*0.05;
            const delivery=0;
            const total=subtotal+gst;
            sessionStorage.setItem('itemsForBilling',JSON.stringify({items:[itemToBill],pricing:{subtotal,gst,delivery,total}}));
            window.location.href='billing.html';
        },"You need to log in to buy this product.");
    };
    overlay.onclick=closeDetails;
    document.querySelector('.details-card').addEventListener('click',(e)=>e.stopPropagation());
}

function startCountdown(endDate){
    const timerElement=$('#countdownTimer');
    timerElement.style.display='block';
    if(countdownInterval){
        clearInterval(countdownInterval);
    }
    function updateTimer(){
        const now=new Date().getTime();
        const distance=endDate.getTime()-now;
        if(distance<0){
            clearInterval(countdownInterval);
            timerElement.textContent="Offer Expired!";
            timerElement.classList.add('expired');
            const updatedProduct=PRODUCTS.find(p=>p.id===modalState.product.id);
            if(updatedProduct){
                const priceContainer=$('.details-price-container');
                if(priceContainer){
                    // Re-read price/mrp based on current variant selection
                    let mrp = updatedProduct.mrp_price;
                    if(modalState.product.variants && modalState.product.variants.length > 0){
                         mrp = updatedProduct.variants[modalState.selectedVariantIndex].mrp_price;
                    }
                    priceContainer.innerHTML=renderPriceHTML(null,mrp);
                }
            }
            return;
        }
        if(distance<86400000){
            const hours=Math.floor((distance%(1000*60*60*24))/(1000*60*60));
            const minutes=Math.floor((distance%(1000*60*60))/(1000*60));
            const seconds=Math.floor((distance%(1000*60))/1000);
            timerElement.textContent=`Hurry! Offer ends in: ${hours}h ${minutes}m ${seconds}s`;
            timerElement.classList.add('flash');
        }else{
            const days=Math.floor(distance/(1000*60*60*24));
            timerElement.textContent=`Offer ends in: ${days} days`;
            timerElement.classList.remove('flash');
        }
    }
    updateTimer();
    countdownInterval=setInterval(updateTimer,1000);
}

function navigateDetailImages(event,direction){
    event.stopPropagation();
    const totalImages=modalState.product.images.length;
    let newIndex=modalState.currentImageIndex+direction;
    if(newIndex>=totalImages)newIndex=0;
    if(newIndex<0)newIndex=totalImages-1;
    switchToDetailImageByIndex(event,newIndex);
}

// NOTE: This function is re-defined inside openDetails, but kept here for fallback/clarity.
function selectVariant(event,variantIndex){
    event.stopPropagation();
    if(!modalState.product||!modalState.product.variants)return;
    modalState.selectedVariantIndex=variantIndex;
    const selectedVariant=modalState.product.variants[variantIndex];
    const discountEndDate=selectedVariant.discount_end_date?new Date(selectedVariant.discount_end_date):null;
    $('.details-price-container').innerHTML=renderPriceHTML(selectedVariant.price,selectedVariant.mrp_price);
    
    const isVariantOutOfStock=selectedVariant.stock===0;
    const lowStockAlertElement = $('#modalLowStockAlert');
    lowStockAlertElement.innerHTML = getLowStockAlertHTML(selectedVariant.stock);

    const addToCartBtn=$('#modalAddToCartBtn');
    const buyNowBtn=$('#modalBuyNowBtn');
    
    // **MODIFIED: Stock check for Add to Cart / Buy Now buttons (Gray color)**
    if(isVariantOutOfStock){
        addToCartBtn.classList.add('disabled');
        buyNowBtn.classList.add('disabled');
    }else{
        addToCartBtn.classList.remove('disabled');
        buyNowBtn.classList.remove('disabled');
    }
    
    const prevBtn=$('.details-nav-btn.prev');
    const nextBtn=$('.details-nav-btn.next');
    if(isVariantOutOfStock){
        prevBtn.disabled=true;
        nextBtn.disabled=true;
    }else{
        prevBtn.disabled=false;
        nextBtn.disabled=false;
    }
    const outOfStockOverlayElement=$('.details-hero .out-of-stock-overlay');
    if(outOfStockOverlayElement){
        outOfStockOverlayElement.style.display=isVariantOutOfStock?'flex':'none';
    }
    if(selectedVariant.images&&selectedVariant.images.length>0){
        $('#mainDetailImg').src=selectedVariant.images[0];
        const thumbnailsContainer=$('.details-thumbs');
        thumbnailsContainer.innerHTML=selectedVariant.images.map((src,i)=>`<img src="${src}" class="${i===0?"active":""}" onclick="switchToDetailImageByIndex(event, ${i}, true)" alt="Thumbnail ${i+1}">`).join("");
        modalState.currentImageIndex=0;
    }else{
        $('#mainDetailImg').src=modalState.product.images[0];
        const thumbnailsContainer=$('.details-thumbs');
        thumbnailsContainer.innerHTML=modalState.product.images.map((src,i)=>`<img src="${src}" class="${i===0?"active":""}" onclick="switchToDetailImageByIndex(event, ${i})" alt="Thumbnail ${i+1}">`).join("");
        modalState.currentImageIndex=0;
    }
    clearInterval(countdownInterval);
    if(discountEndDate){
        startCountdown(discountEndDate);
    }else{
        $('#countdownTimer').style.display='none';
    }
    $$('#variantButtons .variant-btn').forEach((btn,i)=>{
        btn.classList.remove('active');
        if(i===variantIndex){
            btn.classList.add('active');
        }
    });
}

function switchToDetailImageByIndex(event,index){
    event.stopPropagation();
    
    // Determine the correct image array to use (either variant images or main product images)
    let imagesArray = modalState.product.images;
    if (modalState.product.variants && modalState.product.variants.length > 0) {
        const selectedVariant = modalState.product.variants[modalState.selectedVariantIndex];
        if (selectedVariant.images && selectedVariant.images.length > 0) {
            imagesArray = selectedVariant.images;
        }
    }
    
    if(!modalState.product||index<0||index>=imagesArray.length)return;
    
    modalState.currentImageIndex=index;
    $('#mainDetailImg').src=imagesArray[index];
    $$('.details-thumbs img').forEach((thumb,i)=>thumb.classList.toggle('active',i===index));
}

function closeDetails(){
    document.body.classList.remove('no-scroll');
    const overlay=$("#detailsOverlay");
    if(overlay){
        overlay.hidden=true;
    }
    if(countdownInterval){
        clearInterval(countdownInterval);
        countdownInterval=null;
    }
}
// --- shop ---
function saveCartToStorage(){
    const user=JSON.parse(sessionStorage.getItem("currentUser"));
    if(user){
        localStorage.setItem(`cart_${user.email}`,JSON.stringify(CART));
    }else{
        sessionStorage.setItem('cart_anonymous',JSON.stringify(CART));
    }
}

function loadCartFromStorage(){
    const user=JSON.parse(sessionStorage.getItem("currentUser"));
    if(user){
        CART=JSON.parse(localStorage.getItem(`cart_${user.email}`)||'[]');
        sessionStorage.removeItem('cart_anonymous');
    }else{
        CART=JSON.parse(sessionStorage.getItem('cart_anonymous')||'[]');
    }
    updateCartCount();
}

function addToCart(product,selectedVariant=null,quantity=1){
    
    let cartId=product.id;
    let price=product.price;
    let mrpPrice=product.mrp_price;
    let title=product.title;
    let discountEndDate=product.discount_end_date;
    let variantSpecName=null;
    let category=product.category;
    
    // --- Determine Variant details ---
    if(selectedVariant){
        cartId=`${product.id}-${selectedVariant.specName}`;
        price=selectedVariant.price;
        mrpPrice=selectedVariant.mrp_price;
        discountEndDate=selectedVariant.discount_end_date;
        title=`${product.title} (${selectedVariant.specName})`;
        variantSpecName=selectedVariant.specName;
    }
    // ---------------------------------
    
    const isDiscountValid=(mrpPrice>0&&price>0&&price<mrpPrice);
    const finalPrice=isDiscountValid?price:(mrpPrice>0?mrpPrice:price);
    
    console.log("🛒 Adding to cart:",{cartId,title,finalPrice,qty:quantity, variantSpecName});
    
    const found=CART.find(item=>item.cartId===cartId);
    if(found){
        found.qty+=quantity;
    }else{
        CART.push({...product,cartId,price:finalPrice,title,qty:quantity,variantSpecName,category});
    }
    saveCartToStorage();
    updateCartCount();
    showToast("Product added to cart.");
}

function updateCartCount(){
    const count=CART.reduce((a,c)=>a+c.qty,0);
    const badge=$("#cartCountBadge");
    if(badge){
        badge.textContent=count;
        badge.style.display=count>0?'flex':'none';
    }
}

function initCartPage(){
    const cartSection=$("#cartSection");
    if(!cartSection)return;
    if(CART.length===0){
        cartSection.innerHTML=`<div class="empty-cart-container"><img src="https://rukminim2.flixcart.com/www/800/800/promos/16/05/2019/d438a32e-765a-4d8b-b4a6-520b560971e8.png?q=90" alt="Empty Cart"><h2>Your cart is empty!</h2><p>Add items to it now.</p><a href="shop.html" class="shop-now-btn">Shop Now</a></div>`;
        return;
    }
    const cartItemsHtml=CART.map((item,index)=>{
        const mainImage=(item.images&&item.images.length>0)?item.images[0]:'https://placehold.co/400x300/e0e0e0/757575?text=No+Image';
        return`<div class="cart-item"><div class="item-img-container"><img src="${mainImage}" alt="${item.title}"></div><div class="item-details"><h3 class="item-title">${item.title}</h3><div class="item-price-section"><p class="item-price-display">${Rs(item.price)}</p></div><div class="quantity-controls"><button class="qty-btn" onclick="changeQuantity(${index}, -1)">-</button><span>${item.qty}</span><button class="qty-btn" onclick="changeQuantity(${index}, 1)">+</button></div><div class="item-actions"><button class="remove-item-btn" onclick="removeItemFromCart(${index})">REMOVE</button></div></div></div>`;
    }).join("");
    cartSection.innerHTML=`<div class="cart-page-wrapper"><div class="cart-container"><div class="cart-list"><div class="cart-header"><h2 class="cart-title">My Cart (${CART.length} items)</h2></div><div class="cart-items-wrapper">${cartItemsHtml}</div></div><div class="cart-summary"><div class="price-summary-card" id="cartPriceSummary"></div><div class="cart-actions"><a href="shop.html" class="btn secondary">Return to Shop</a><button class="btn primary" onclick="goBilling()">Place Order</button></div></div></div></div>`;
    updateCartTotals();
}

function updateCartTotals(){
    console.log("Current CART state:",CART);
    console.log("🧾 subtotal calc check:",CART.map(i=>({title:i.title,price:i.price,qty:i.qty,lineTotal:i.price*i.qty})));
    const subtotal=CART.reduce((acc,item)=>acc+(item.price*item.qty),0);
    const gst=subtotal*0.05;
    const total=subtotal+gst;
    const cartPriceSummary=$('#cartPriceSummary');
    if(cartPriceSummary){
        cartPriceSummary.innerHTML=`<div class="price-summary-header">Price Details</div><div class="price-summary-body"><div class="price-summary-row"><span>Price (${CART.reduce((acc,item)=>acc+item.qty,0)} items)</span><span>${Rs(subtotal.toFixed(2))}</span></div><div class="price-summary-row"><span>GST (5%)</span><span>+ ${Rs(gst.toFixed(2))}</span></div><hr/><div class="price-summary-row price-summary-total"><span>Total Amount</span><span>${Rs(total.toFixed(2))}</span></div></div>`;
    }
}

function changeQuantity(index,delta){
    if(!CART[index])return;
    CART[index].qty+=delta;
    if(CART[index].qty<=0)CART.splice(index,1);
    saveCartToStorage();
    updateCartCount();
    initCartPage();
}

function removeItemFromCart(index){
    CART.splice(index,1);
    saveCartToStorage();
    updateCartCount();
    initCartPage();
}

function goBilling(){
    if(CART.length===0){
        showToast("Your cart is empty.",true);
        return;
    }
    requireLogin(()=>{
        const subtotal=CART.reduce((acc,item)=>acc+(item.price*item.qty),0);
        const gst=subtotal*0.05;
        const total=subtotal+gst;
        // FIX 1: Ensure all numerical properties are stored as numbers to prevent issues in billing
        const billingInfo={items:CART,pricing:{subtotal: Number(subtotal), gst: Number(gst), delivery: 0, total: Number(total)}};
        sessionStorage.setItem('itemsForBilling',JSON.stringify(billingInfo));
        window.location.href='billing.html';
    },"You need to log in to place an order.");
}
// --- cart ---

/**
 * MODIFIED: initBillingPage function
 * - Ensures the billing actions buttons are placed within a single container 
 * with the class 'billing-actions-bottom small-btn-group' for correct inline display.
 */
function initBillingPage(){
    const billingSection=$('#billingSection');
    if(!billingSection)return;
    const razorpayScript=document.createElement('script');
    razorpayScript.src='https://checkout.razorpay.com/v1/checkout.js';
    document.body.appendChild(razorpayScript);
    const billingInfo=JSON.parse(sessionStorage.getItem('itemsForBilling'));
    const currentUser=JSON.parse(sessionStorage.getItem('currentUser'));
    if(!currentUser||!billingInfo||!billingInfo.items.length){
        showToast("There are no items to checkout. Please add items to your cart first.",true);
        billingSection.innerHTML='<div class="empty-cart-container"><img src="https://rukminim2.flixcart.com/www/800/800/promos/16/05/2019/d438a32e-765a-4d8b-b4a6-520b560971e8.png?q=90" alt="Empty Cart"><h2>Your order list is empty!</h2><a href="shop.html" class="shop-now-btn">Shop Now</a></div>';
        return;
    }
    const {items,pricing}=billingInfo;
    
    // FIX 2: Explicitly convert prices to float number type when extracting from pricing
    const subtotal = parseFloat(pricing.subtotal);
    const gst = parseFloat(pricing.gst);
    
    let delivery=0;
    // FIX 3: Ensure calculation uses numbers
    let total=subtotal+gst;
    
    const itemsHtml=items.map(item=>{
        const mainImage=(item.images&&item.images.length>0)?item.images[0]:'https://placehold.co/400x300/e0e0e0/757575?text=No+Image';
        return`<div class="billing-item"><img src="${mainImage}" alt="${item.title}"><div class="billing-item-details"><p class="title">${item.title}</p><p class="price">${Rs(item.price)} x ${item.qty}</p></div></div>`;
    }).join('');
    
    // FIX 4: Refactored renderPriceDetails to use numerical inputs and ensure finalTotal is calculated correctly
    const renderPriceDetails=(deliveryCharge)=>{
        const finalTotal = subtotal + gst + deliveryCharge; // These are guaranteed numbers now
        return`<div class="billing-card"><h3>Price Details</h3><div class="billing-price-summary"><div class="price-summary-row"><span>Price (${items.reduce((acc,item)=>acc+item.qty,0)} items)</span><span>${Rs(subtotal.toFixed(2))}</span></div><div class="price-summary-row"><span>GST (5%)</span><span>+ ${Rs(gst.toFixed(2))}</span></div><div class="price-summary-row"><span>Delivery Charges</span><span>${deliveryCharge===0?'<span class="free-delivery">Free</span>':`+ ${Rs(deliveryCharge.toFixed(2))}`}</span></div><hr><div class="price-summary-row total-row"><span>Total Amount</span><span>${Rs(finalTotal.toFixed(2))}</span></div></div></div>`;
    };
    
    // Corrected HTML structure: billing-actions-bottom with small-btn-group
    // MODIFIED: Updated QR Modal HTML structure to include file input and use 'Upload & Submit' button
    const billingSectionHTML=`<div class="billing-container"><h2 class="section-title">Checkout</h2><div class="billing-details-summary"><div class="billing-form-column"><div class="billing-card"><h3>Delivery Address</h3><form id="billingForm"><div class="form-group grid-2"><div class="input-box"><label for="customerName">Name</label><input type="text" id="customerName" name="customerName" value="${currentUser.first_name} ${currentUser.last_name}" required></div><div class="input-box"><label for="customerPhone">Phone Number</label><input type="tel" id="customerPhone" name="customerPhone" maxlength="10" inputmode="numeric" required></div></div><div class="form-group"><label for="customerAddress">Address</label><textarea id="customerAddress" name="customerAddress" required></textarea></div><div class="form-group grid-2"><div class="input-box"><label for="customerCity">City</label><input type="text" id="customerCity" name="customerCity" required></div><div class="input-box"><label for="customerPincode">Pincode</label><input type="text" id="customerPincode" name="customerPincode" maxlength="6" inputmode="numeric" required></div></div><div class="billing-card payment-method-card"><h3>Payment Method</h3><div class="form-group"><label for="paymentMethodSelector">Select Payment Method:</label><select id="paymentMethodSelector" class="payment-method-selector" name="payment_method"><option value="default">-- Select a method --</option><option value="upi">UPI</option><option value="online">Online Payment (Card / Net Banking)</option><option value="cod">Cash on Delivery (COD)</option></select></div></div><div class="billing-actions-bottom small-btn-group"><a href="cart.html" class="btn secondary">Return to Cart</a><button type="submit" class="btn primary" id="confirmOrderBtn">Confirm Order</button></div></form></div></div><div class="billing-summary-column"><div id="priceDetailsContainer">${renderPriceDetails(delivery)}</div><div class="billing-card order-items-card"><h3>Order Items</h3><div id="orderItemsContainer">${itemsHtml}</div></div></div></div></div><div id="qrModalOverlay" class="modal-overlay" style="display: none;"><div class="qr-modal-content"><button class="qr-modal-close-btn">&times;</button><div id="upiInitialView"><h3>UPI Payment</h3><p>Scan the QR Code below to pay</p><div id="qrCodeImageContainer"></div><div class="qr-code-details"><p id="qrModalAmount"></p></div><div class="form-group" style="margin-top: 15px;"><label for="paymentScreenshot" style="font-size: 14px; display: block; margin-bottom: 5px; font-weight: 600;">Upload Payment Screenshot:</label><input type="file" id="paymentScreenshot" accept="image/*" required></div><div class="qr-buttons"><button class="btn primary small" id="qrConfirmPaymentBtn">Upload & Submit</button></div></div><div id="upiSuccessView" style="display: none; text-align: center;"><svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" fill="#4CAF50" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.429 10.31a.75.75 0 0 0 .012 1.053l3.65 3.5a.75.75 0 0 0 1.077-1.026L5.68 5.68a.75.75 0 0 0-1.06-.01L2.03 9.77a.75.75 0 0 0 1.08 1.026l3.413-3.65 4.54-5.01a.75.75 0 0 0-.022-1.08z"/></svg><h3>Payment Successful!</h3><p>Your order is being processed.</p></div></div></div>`;
    billingSection.innerHTML=billingSectionHTML;
    const DELIVERY_THRESHOLDS={mobiles:25000,laptops:40000,tvs:30000,accessories:1500,smartwatch:1500,};
    const DEFAULT_DELIVERY_CHARGE=40;
    const updatePricing=()=>{
        const paymentMethod=$('#paymentMethodSelector').value;
        let currentDeliveryCharge=0;
        
        if(paymentMethod==='online'||paymentMethod==='net_banking'||paymentMethod==='upi'){
            currentDeliveryCharge=0;
        }else if(paymentMethod==='cod'){
            const categoryTotals=items.reduce((totals,item)=>{
                const product=PRODUCTS.find(p=>p.id===item.id);
                if(product){
                    if(!totals[product.category]){
                        totals[product.category]=0;
                    }
                    totals[product.category]+=item.price*item.qty;
                }
                return totals;
            },{});
            const isFreeDelivery=Object.keys(categoryTotals).some(category=>DELIVERY_THRESHOLDS[category]&&categoryTotals[category]>=DELIVERY_THRESHOLDS[category]);
            currentDeliveryCharge=isFreeDelivery?0:DEFAULT_DELIVERY_CHARGE;
        }
        
        // FIX 5: Use the already calculated number values
        const finalTotal = subtotal + gst + currentDeliveryCharge; 
        
        const priceDetailsContainer=$('#priceDetailsContainer');
        if(priceDetailsContainer){
            priceDetailsContainer.innerHTML=renderPriceDetails(currentDeliveryCharge);
        }
        
        // FIX 6: Ensure updated values are stored as numbers 
        billingInfo.pricing.delivery=Number(currentDeliveryCharge);
        billingInfo.pricing.total=Number(finalTotal);
        
        // Re-store the corrected number values
        sessionStorage.setItem('itemsForBilling',JSON.stringify(billingInfo));
        
        const confirmBtn=$('#confirmOrderBtn');
        if(confirmBtn){
            confirmBtn.style.display='block';
            confirmBtn.textContent=(paymentMethod==='upi')?'Generate QR Code':'Confirm Order';
        }
    };
    updatePricing();
    $('#paymentMethodSelector').addEventListener('change',updatePricing);
    $('#billingForm').addEventListener('submit',placeOrder);
    const qrModalCloseBtn=$('.qr-modal-close-btn');
    if(qrModalCloseBtn){
        qrModalCloseBtn.addEventListener('click',(e)=>{
            e.stopPropagation();
            closeQrModal();
        });
    }
    const qrModalOverlay=$('#qrModalOverlay');
    if(qrModalOverlay){
        qrModalOverlay.addEventListener('click',(e)=>{
            if(e.target.id==='qrModalOverlay'){
                closeQrModal();
            }
        });
    }
}

function simulateUpiPaymentSuccess(orderData,items,billingInfo){
    closeQrModal();
    // UPI payment is success, so status is 'Paid'
    orderData.status='Paid'; 
    sendOrderToServer(orderData,items,billingInfo);
}

async function placeOrder(e){
    e.preventDefault();
    const billingInfo=JSON.parse(sessionStorage.getItem('itemsForBilling'));
    const currentUser=JSON.parse(sessionStorage.getItem('currentUser'));
    const paymentMethod=$('#paymentMethodSelector').value;
    if(paymentMethod==='default'){
        showToast("Please select a valid payment method.",true);
        return;
    }
    if(!billingInfo||!currentUser){
        showToast("Invalid checkout data. Please try again.",true);
        return;
    }
    const {items,pricing}=billingInfo;
    const customerData={name:$('#customerName').value,phone:$('#customerPhone').value,address:$('#customerAddress').value.trim(),city:$('#customerCity').value.trim(),pincode:$('#customerPincode').value.trim()};
    const fullAddress=`${customerData.address}, ${customerData.city} - ${customerData.pincode}`;
    
    // MODIFICATION START: Prepare detailed product list and price summary for server email
    const productListForEmail = items.map(item => ({
        name: item.title,
        quantity: item.qty,
        price: item.price,
        lineTotal: (item.price * item.qty).toFixed(2),
        // OPTIONAL: Include a price comparison if available for original price/MRP
        originalPrice: item.mrp_price > item.price ? item.mrp_price : null
    }));
    
    // Determine the payment status text for the email
    let paymentStatusText = (paymentMethod === 'online' || paymentMethod === 'upi') ? 'Paid' : 'Not Paid (COD)';
    
    const emailSummary = {
        products: productListForEmail,
        totals: {
            subtotal: Number(pricing.subtotal).toFixed(2),
            gst: Number(pricing.gst).toFixed(2),
            delivery: Number(pricing.delivery).toFixed(2),
            total: Number(pricing.total).toFixed(2)
        },
        paymentStatus: paymentStatusText,
        shippingAddress: fullAddress
    };
    // MODIFICATION END
    
    // MODIFIED: Added variantSpecName to the summary array for stock update
    const summaryArray=items.map(item=>({
        id:item.id,
        name:item.title,
        quantity:item.qty,
        image:(item.images&&item.images.length>0)?item.images[0]:'https://placehold.co/400x300/e0e0e0/757575?text=No+Image',
        variantSpecName:item.variantSpecName // Crucial for variant stock deduction
    }));
    const productsSummaryString=JSON.stringify(summaryArray);
    
    // **MODIFICATION 1: All initial orders start as 'Pending' in DB.**
    let initialStatus = 'Pending'; 

    const orderData={
        orderId:`order_${Date.now()}`,
        orderDate:new Date().toISOString().slice(0,10),
        userEmail:currentUser.email,
        customerName:customerData.name,
        customerPhone:customerData.phone,
        customerAddress:fullAddress,
        total:pricing.total,
        status:initialStatus, // Use 'Pending' for all initial orders
        products_summary:productsSummaryString,
        razorpay_order_id:null,
        razorpay_payment_id:null,
        paymentMethod:paymentMethod,
        // NEW: Send the simplified summary data structure to the server for email generation
        email_summary: JSON.stringify(emailSummary) 
    };

    if(paymentMethod==='online'||paymentMethod==='net_banking'){
        const amountInPaise=Math.round(Number(pricing.total)*100);
        try{
            // 🚩 FIX: Removed localhost, using relative path
            const razorpayOrderRes=await fetch('/api/create-razorpay-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:amountInPaise,receipt:orderData.orderId})});
            if(!razorpayOrderRes.ok){
                const errorData=await razorpayOrderRes.json();
                console.error("Razorpay Order Creation Failed:",errorData);
                throw new Error(errorData.error||`Server responded with a ${razorpayOrderRes.status} status. Check your server logs.`);
            }
            const razorpayOrder=await razorpayOrderRes.json();
            
            // Set order ID from Razorpay receipt/DB standard
            orderData.orderId = razorpayOrder.receipt; 
            
            // NEW: Update orderData with new Razorpay ID
            orderData.email_summary = JSON.stringify({
                ...emailSummary,
                paymentStatus: 'Paid', // Pre-assume paid status for online flow
                orderId: orderData.orderId
            });

            const options={
                key:"rzp_test_RH4lIyt42awGG1",
                amount:razorpayOrder.amount,
                currency:"INR",
                name:"Smart Tech Shop",
                description:"Order Payment",
                order_id:razorpayOrder.id,
                methods:{upi_qr:true},
                handler:async function(response){
                    // Payment success: 
                    orderData.razorpay_order_id=response.razorpay_order_id;
                    orderData.razorpay_payment_id=response.razorpay_payment_id;
                    
                    try{
                        // 1. Verify payment on server side
                        // 🚩 FIX: Removed localhost, using relative path
                        const verifyRes=await fetch("/api/verify-payment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(response)});
                        
                        if(!verifyRes.ok){
                            throw new Error('Payment verification failed.');
                        }
                        
                        // **CORE FIX: Order is CREATED in DB ONLY AFTER verification (Status: Pending).**
                        orderData.status = 'Pending';
                        const createOrderRes = await sendOrderToServer(orderData, items, billingInfo, false, true); 
                        if (createOrderRes.status !== 'success') throw new Error('Failed to create final order entry.');

                        // 2. Finalize client side actions (which now only includes stock update and redirect).
                        await finalizeClientOrder(orderData, items, billingInfo); 
                        
                    }catch(error){
                        console.error("Payment verification/update error:",error);
                        showToast(`Payment verification failed: ${error.message}`,true);
                    }
                },
                modal: {
                    ondismiss: function() {
                        // Handle dismissal of payment modal (optional)
                        console.log('Payment modal dismissed. No order recorded.');
                    }
                },
                theme:{color:"#3399cc"}
            };
            const rzp1=new Razorpay(options);
            rzp1.open();

        }catch(error){
            console.error("Online payment error:",error);
            showToast("Failed to process online payment. Check the console for details.",true);
        }
    }else if(paymentMethod==='upi'){
        const qrModal=$('#qrModalOverlay');
        const upiId='saravana272005-3@oksbi';
        const amount=Number(pricing.total); // FIX 7: Ensure amount is a number
        const transactionNote=encodeURIComponent(`Order ID: ${orderData.orderId}`);
        const upiLink=`upi://pay?pa=${upiId}&pn=Smart%20Tech%20Shop&mc=5499&tid=${orderData.orderId}&am=${amount}&tn=${transactionNote}`;
        
        // Reset and display initial view
        $('#upiSuccessView').style.display = 'none';
        $('#upiInitialView').style.display = 'block';
        $('#paymentScreenshot').value = '';
        
        $('#qrCodeImageContainer').innerHTML=`<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}" alt="UPI QR Code">`;
        $('#qrModalAmount').textContent=`Total Amount: ${Rs(Number(pricing.total))}`; // FIX 8: Ensure display uses number
        $('#confirmOrderBtn').style.display='none';
        $('#paymentMethodSelector').disabled=true;
        $('#billingForm').style.display='none';
        qrModal.style.display='flex';
        
        // UPI flow is manual/simulated. Order must be recorded ONLY AFTER user confirms payment.
        
        $('#qrConfirmPaymentBtn').onclick=async ()=>{
            const screenshotInput = $('#paymentScreenshot');
            if (!screenshotInput.files || screenshotInput.files.length === 0) {
                 showToast("Please upload the payment screenshot to proceed.", true);
                 return;
            }
            
            // Show payment successful message in the modal
            $('#upiInitialView').style.display = 'none';
            $('#upiSuccessView').style.display = 'block';
            
            // Wait a moment for the user to see the success message
            await new Promise(resolve => setTimeout(resolve, 1500)); 
            
            closeQrModal();
            showToast('Payment Sent Confirmed. Redirecting...',false);
            
            // **CORE FIX: UPI Order is CREATED in DB ONLY AFTER user confirmation (Status: Pending).**
            orderData.status = 'Pending';
            
            const createOrderRes = await sendOrderToServer(orderData, items, billingInfo, false, true);
            if (createOrderRes.status !== 'success') {
                 showToast("Failed to record UPI order. Please contact support.", true);
                 return;
            }

            // Finalize client side actions (Stock update and redirect)
            await finalizeClientOrder(orderData, items, billingInfo);
        };
    }else{
        // COD Flow: The order is recorded immediately as it's not a pre-paid transaction.
        await sendOrderToServer(orderData,items,billingInfo, true); // Create order and redirect
    }
}

function closeQrModal(){
    const qrModal=$('#qrModalOverlay');
    if(qrModal){
        qrModal.style.display='none';
        $('#confirmOrderBtn').style.display='block';
        $('#paymentMethodSelector').disabled=false;
        $('#billingForm').style.display='block';
        
        // Reset modal view when closing
        $('#upiSuccessView').style.display = 'none';
        $('#upiInitialView').style.display = 'block';
        $('#paymentScreenshot').value = '';
    }
}

// ** Finalize client order (Update Stock and Redirect) **
async function finalizeClientOrder(orderData, items, billingInfo) {
    // 1. Map the items to include only the necessary fields for stock update
    const stockUpdateItems = items.map(item => ({
        id: item.id,
        qty: item.qty,
        variantSpecName: item.variantSpecName // Variant name is sent here
    }));
    
    // 2. Update the product stock on the server
    await updateProductStock(stockUpdateItems); 
    
    // 3. Re-fetch products (to get updated stock status)
    await fetchProducts();
    
    // 4. Clear cart if the order was placed from the cart
    const isFromCart = JSON.stringify(CART) === JSON.stringify(items);
    if (isFromCart) {
        CART = [];
        saveCartToStorage();
        updateCartCount();
    }
    
    // 5. Clear session and store final order details
    sessionStorage.removeItem('itemsForBilling');
    
    const fullOrderDetails = {...orderData, cart: items, pricing: billingInfo.pricing, paymentMethod: orderData.paymentMethod};
    sessionStorage.setItem('lastOrder', JSON.stringify(fullOrderDetails));

    // **MODIFICATION 1: Removed the 2-second delay.**
    showToast('Order placed successfully! Redirecting...');
    window.location.href = "order.html?status=success";
}

// MODIFIED: This function is now used ONLY to POST the final order data to the server.
async function sendOrderToServer(orderData,items,billingInfo, shouldRedirect = true, sendOnly = false){
    try{
        // 🚩 FIX: Removed localhost, using relative path
        const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(orderData),});
        
        if(!response.ok){
            const errorText=await response.text();
            console.error('Failed to create order:',errorText);
            showToast('Failed to place order. Please try again.',true);
            return { status: 'error' };
        }
        const result=await response.json();
        console.log('Order created successfully:',result);
        
        // 2. Client-side actions for COD (if not sendOnly)
        if (shouldRedirect) {
            await finalizeClientOrder(orderData, items, billingInfo);
        }
        return { status: 'success', orderId: orderData.orderId, dbId: result.id };
        
    }catch(error){
        console.error('Network or server error:',error);
        showToast('A network error occurred. Please try again later.',true);
        return { status: 'error' };
    }
}

async function updateProductStock(items){
    try{
        // 🚩 FIX: Removed localhost, using relative path
        const response=await fetch('/api/products/update-stock',{method:'PUT',headers:{'Content-Type':'application/json',},body:JSON.stringify({items}),});
        const result=await response.json();
        if(!response.ok){
            console.error('Failed to update stock:',result.error);
        }else{
            console.log('Stock updated successfully:',result.message);
        }
    }catch(error){
        console.error('Error updating stock:',error);
    }
}
// --- billing ---
function initOrderPage(){
    const container=$('#order-success-section');
    if(!container)return;
    const order=JSON.parse(sessionStorage.getItem('lastOrder'));
    if(!order){
        container.innerHTML='<h2>Error: Order details not found. <a href="index.html">Go to Home</a></h2>';
        return;
    }

    // NEW LOGIC: Determine Payment Status (MODIFICATION 4 - Refined Payment Status)
    // isPaid is true if: (1) payment method is online or upi, OR (2) payment method is cod AND order status is Delivered.
    const isPaid = (order.paymentMethod === 'online' || order.paymentMethod === 'upi') || (order.paymentMethod === 'cod' && order.status === 'Delivered'); 
    const paymentStatusText = isPaid ? 'Paid' : 'Not Paid';
    const paymentStatusClass = isPaid ? 'paid' : 'not-paid';
    
    const itemsHTML=order.cart.map(item=>{
        const mainImage=(item.images&&item.images.length>0)?item.images[0]:'https://placehold.co/400x300/e0e0e0/757575?text=No+Image';
        return`<div class="order-summary-item"><img src="${mainImage}" alt="${item.title}"><div class="order-summary-item-info"><h4>${item.title}</h4><p>Quantity: ${item.qty}</p></div><div class="order-summary-price">${Rs(item.price*item.qty)}</div></div>`;
    }).join('');

    // FIX 9: Ensure all numbers from order.pricing are treated as numbers
    const p = order.pricing;
    const subtotal = Number(p.subtotal);
    const gst = Number(p.gst);
    const delivery = Number(p.delivery);
    const total = Number(p.total);

    // MODIFIED: Added Payment Status
    container.innerHTML=`<div class="success-container"><div class="success-icon">✅</div><h2>Order Placed Successfully!</h2><p>Your complete order summary is below:</p><div class="summary" id="order-summary"><p><strong>Name:</strong> ${order.customerName}</p><p><strong>Phone:</strong> ${order.customerPhone}</p><p><strong>Address:</strong> ${order.customerAddress}</p><p><strong>Payment Status:</strong> <span class="payment-status-badge ${paymentStatusClass}">${paymentStatusText}</span></p><div class="order-summary-items">${itemsHTML}</div><div class="order-summary-totals"><p><span>Subtotal:</span> <span>${Rs(subtotal.toFixed(2))}</span></p><p><span>GST (5%)</span><span>+ ${Rs(gst.toFixed(2))}</span></p><p><span>Delivery:</span> <span>+ ${Rs(delivery.toFixed(2))}</span></p><p><strong>Total Amount:</strong> <strong>${Rs(total.toFixed(2))}</strong></p></div></div><div class="action-buttons"><a href="index.html" class="home-btn">Return to Home</a><button class="print-btn" onclick="printInvoice()">Print Invoice</button></div></div>`;
}

function printInvoice(){
    // பிரிண்டிங் CSS மூலம் கையாளப்படுவதால், இங்கே window.print() ஐ அழைத்தால் போதும்.
    window.print();
}
// --- order ---
function getHiddenOrdersKey(){
    return `hidden_orders_${JSON.parse(sessionStorage.getItem("currentUser"))?.email||'anonymous'}`;
}

function loadHiddenOrders(){
    const user=JSON.parse(sessionStorage.getItem("currentUser"));
    if(user){
        HIDDEN_ORDER_IDS=JSON.parse(localStorage.getItem(getHiddenOrdersKey())||'[]');
    }else{
        HIDDEN_ORDER_IDS=[];
    }
}

function saveHiddenOrders(){
    const user=JSON.parse(sessionStorage.getItem("currentUser"));
    if(user){
        localStorage.setItem(getHiddenOrdersKey(),JSON.stringify(HIDDEN_ORDER_IDS));
    }
}

function initMyOrdersPage(){
    const container=$('#myOrdersContent');
    if(!container)return;
    const currentUser=JSON.parse(sessionStorage.getItem("currentUser"));
    if(!currentUser){
        container.innerHTML='<p>Log in to view your orders.</p>';
        return;
    }
    loadHiddenOrders(); // Ensure hidden orders are loaded before fetching
    fetchOrdersFromServer(currentUser.email,container);
}

async function fetchOrdersFromServer(email,container){
    try{
        // 🚩 FIX: Removed localhost, using relative path
        const response=await fetch(`/api/orders/user/${email}`);
        const allOrders=await response.json();
        
        // Filter out orders the user has chosen to hide locally
        const orders = allOrders.filter(order => !HIDDEN_ORDER_IDS.includes(order.id));

        if(orders.length===0 && allOrders.length === 0){
            container.innerHTML=`<div class="empty-wishlist-container"><h2>You haven't placed any orders yet!</h2><p>All your future orders will appear here.</p><a href="shop.html" class="shop-now-btn">Start Shopping</a></div>`;
            return;
        } else if (orders.length === 0 && allOrders.length > 0) {
             container.innerHTML=`<div class="empty-wishlist-container"><h2>All your past orders are currently hidden.</h2><p>They can be restored by clearing your browser's local storage.</p><a href="shop.html" class="shop-now-btn">Start Shopping</a></div>`;
             return;
        }
        
        container.innerHTML=orders.map(order=>{
            const statusClass=order.status.toLowerCase();
            
            // NEW LOGIC: Determine Payment Status (MODIFICATION 5 - Refined Payment Status)
            // isPaid is true if: (1) payment_method is online/upi, OR (2) payment_method is COD - Paid.
            const isPaid = (order.payment_method === 'online' || order.payment_method === 'upi' || order.payment_method === 'COD - Paid');
            const paymentStatusText = isPaid ? 'Paid' : 'Not Paid';
            const paymentStatusClass = isPaid ? 'paid' : 'not-paid';

            let itemsHTML='';
            try{
                const productSummary=(typeof order.products_summary==='string')?JSON.parse(order.products_summary):order.products_summary;
                if(Array.isArray(productSummary)){
                    itemsHTML=productSummary.map(item=>{
                        const imageUrl=item.image?item.image:'https://placehold.co/100x100/e0e0e0/757575?text=No+Image';
                        const hasReviewed=REVIEWS[order.orderId]&&REVIEWS[order.orderId][item.id];
                        const rateAndReviewButton=(order.status==='Delivered')?`<button class="btn small ${hasReviewed?'disabled':''}" ${hasReviewed?'disabled':''} onclick="openRatingAndReviewModal('${order.orderId}', '${item.id}')">${hasReviewed?'Rated':'Rate & Review'}</button>`:'';
                        return`<div class="order-summary-item"><img src="${imageUrl}" alt="${item.name}"><div class="order-summary-item-info"><h4>${item.name}</h4><p>Quantity: ${item.quantity}</p>${rateAndReviewButton}</div></div>`;
                    }).join('');
                }else{
                    itemsHTML='<p>Could not load product details.</p>';
                }
            }catch(e){
                console.error("Could not parse products_summary:",e);
                itemsHTML='<p>Could not load product details.</p>';
            }
            const showCancelButton=order.status==='Pending'||order.status==='Shipped';
            const cancelButtonHTML=showCancelButton?`<button class="btn small danger" onclick="cancelOrder('${order.id}')">Cancel Order</button>`:'';
            
            // MODIFIED: Added Payment Status and the new 'Remove History' button
            return`<div class="order-card"><div class="order-card-header"><div><strong>Order ID:</strong> ${order.orderId}</div><div><strong>Order Date:</strong> ${new Date(order.orderDate).toLocaleDateString()}</div><div><strong>Total:</strong> ${Rs(parseFloat(order.total).toFixed(2))}</div><div class="order-status ${statusClass}"><strong>Status:</strong> ${order.status}</div><div><strong>Payment:</strong> <span class="payment-status-badge ${paymentStatusClass}">${paymentStatusText}</span></div></div><div class="order-card-body"><div class="order-items-container">${itemsHTML}</div><div class="order-delivery-details"><h5>Delivery Address</h5><button class="modal-close-button small-close-btn" style="position: absolute; top: 5px; right: 5px;" onclick="removeOrderFromLocalHistory('${order.id}', '${order.orderId}')">&times;</button><p>${order.customerName}</p><p>${order.customerAddress}</p><p>Phone: ${order.customerPhone}</p><div class="action-buttons">${cancelButtonHTML}</div></div></div></div>`;
        }).join('');
    }catch(error){
        console.error("Error fetching orders:",error);
        container.innerHTML=`<p>Failed to load orders. Please try again later.</p>`;
        showToast('Failed to load orders.',true);
    }
}

// NEW FUNCTION: Removes the order from the user's local view only.
function removeOrderFromLocalHistory(orderServerId, orderId){
    showConfirmation("Are you sure you want to remove this order from your history?",()=>{
        // orderServerId is the database 'id' of the order, used for reliable hiding.
        if (!HIDDEN_ORDER_IDS.includes(orderServerId)) {
            HIDDEN_ORDER_IDS.push(orderServerId);
            saveHiddenOrders();
            showToast(`Order ${orderId} removed from your local history.`);
            initMyOrdersPage(); // Re-render the page to show the filtered list
        }
    },"This action only hides the order from your screen and does not cancel or delete it from the system.");
}


function cancelOrder(orderId){
    showConfirmation("Are you sure?",async()=>{
        try{
            // 🚩 FIX: Removed localhost, using relative path
            const response=await fetch(`/api/orders/${orderId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'Cancelled'})});
            if(response.ok){
                showToast("Order cancelled.");
                initMyOrdersPage();
            }else{
                const errorResult=await response.json();
                showToast(errorResult.message||"Failed to cancel order.",true);
            }
        }catch(error){
            console.error('Error cancelling order:',error);
            showToast("Network error. Failed to cancel order.",true);
        }
    },"This action will cancel your order.");
}
// OLD removeOrderHistory function removed as requested.

// --- my order ---
function createRatingAndReviewModal(){
    if($('#ratingAndReviewModalOverlay'))return;
    document.body.insertAdjacentHTML('beforeend',`<div id="ratingAndReviewModalOverlay" class="modal-overlay"><div class="login-modal-content" style="max-width: 500px;"><div class="login-modal-header"><h3>Rate & Review</h3><button class="modal-close-button" onclick="closeRatingAndReviewModal()">&times;</button></div><div id="ratingAndReviewModalContent" class="form-container"></div></div></div>`);
    $('#ratingAndReviewModalOverlay').addEventListener('click',closeRatingAndReviewModal);
    $('#ratingAndReviewModalOverlay .login-modal-content').addEventListener('click',e=>e.stopPropagation());
}

function openRatingAndReviewModal(orderId,productId){
    const product=PRODUCTS.find(p=>p.id===productId);
    if(!product){
        showToast("Product not found.",true);
        return;
    }
    createRatingAndReviewModal();
    ratingState={orderId,productId,rating:0};
    const content=$('#ratingAndReviewModalContent');
    const mainImage=(product.images&&product.images.length>0)?product.images[0]:'https://placehold.co/150x150/e0e0e0/757575?text=No+Image';
    const existingReview=REVIEWS[orderId]&&REVIEWS[orderId][productId];
    content.innerHTML=`<div style="text-align: center;"><img src="${mainImage}" alt="${product.title}" style="width: 150px; height: 150px; object-fit: contain; margin-bottom: 15px;"><h4>${product.title}</h4><div class="star-rating-input" id="ratingStars">${[...Array(5)].map((_,i)=>`<span class="star" data-value="${i+1}">☆</span>`).join('')}</div><div class="form-group" style="margin-top: 20px;"><label for="reviewText">Enter your review here:</label><textarea id="reviewText" rows="4" placeholder="What do you think of this product?" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 8px;"></textarea></div><button id="submitRatingAndReviewBtn" class="login-button" style="margin-top: 20px;">Submit</button></div>`;
    if(existingReview){
        ratingState.rating=existingReview.rating;
        const stars=$$('#ratingStars .star');
        stars.forEach((s,i)=>{
            s.innerHTML=i<existingReview.rating?'★':'☆';
        });
    }
    $$('#ratingStars .star').forEach(star=>{
        star.addEventListener('click',()=>{
            ratingState.rating=parseInt(star.dataset.value);
            $$('#ratingStars .star').forEach((s,i)=>{
                s.innerHTML=i<ratingState.rating?'★':'☆';
            });
        });
    });
    $('#submitRatingAndReviewBtn').onclick=()=>submitRatingAndReview();
    document.body.classList.add('no-scroll');
    $('#ratingAndReviewModalOverlay').style.display='flex';
}

function closeRatingAndReviewModal(){
    document.body.classList.remove('no-scroll');
    if($('#ratingAndReviewModalOverlay')){
        $('#ratingAndReviewModalOverlay').style.display='none';
    }
}

function createAllReviewsModal(){
    if($('#allReviewsModalContent')){
        return;
    }
    const incompleteOverlay=$('#allReviewsModalOverlay');
    if(incompleteOverlay){
        incompleteOverlay.remove();
    }
    document.body.insertAdjacentHTML('beforeend',`<div id="allReviewsModalOverlay" class="modal-overlay"><div class="login-modal-content"><div class="login-modal-header"><h3>My Reviews</h3><button class="modal-close-button" onclick="closeAllReviewsModal()">&times;</button></div><div id="allReviewsModalContent" class="form-container"></div></div></div>`);
    $('#allReviewsModalOverlay').addEventListener('click',closeAllReviewsModal);
    $('#allReviewsModalOverlay .login-modal-content').addEventListener('click',e=>e.stopPropagation());
}

async function submitRatingAndReview(){
    const {orderId,productId,rating}=ratingState;
    const currentUser=JSON.parse(sessionStorage.getItem("currentUser"));
    if(!currentUser){
        showToast("You must be logged in.",true);
        return;
    }
    if(rating===0){
        showToast("Please select a star rating.",true);
        return;
    }
    const product=PRODUCTS.find(p=>p.id===productId);
    if(!product){
        showToast("Product not found.",true);
        return;
    }
    if(!REVIEWS[orderId]){
        REVIEWS[orderId]={};
    }
    const previousRating=REVIEWS[orderId][productId]?.rating||0;
    if(previousRating===0){
        product.reviews++;
    }else{
        product.ratingBreakdown[previousRating]=Math.max(0,product.ratingBreakdown[previousRating]-1);
    }
    product.ratingBreakdown[rating]=(product.ratingBreakdown[rating]||0)+1;
    const totalRatings=Object.values(product.ratingBreakdown).reduce((a,b)=>a+b,0);
    const totalStars=Object.entries(product.ratingBreakdown).reduce((acc,[star,count])=>acc+(parseInt(star)*count),0);
    product.rating=parseFloat((totalStars/totalRatings).toFixed(1));
    REVIEWS[orderId][productId]={rating:rating,review:"",userName:currentUser.first_name,date:new Date().toLocaleDateString()};
    try{
        // 🚩 FIX: Removed localhost, using relative path
        const response=await fetch(`/api/products/rate/${productId}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rating:product.rating,reviews:product.reviews,ratingBreakdown:product.ratingBreakdown})});
        if(!response.ok){
            const errorData=await response.json();
            throw new Error(errorData.error||'Failed to update rating on server.');
        }
        saveData();
        closeRatingAndReviewModal();
        showToast("Your rating and review has been submitted!");
        initMyOrdersPage();
    }catch(error){
        console.error('Error submitting rating to server:',error);
        showToast(`Error submitting rating: ${error.message}`,true);
        loadData();
        initMyOrdersPage();
    }
}

function openAllReviewsModal(productId){
    createAllReviewsModal();
    const product=PRODUCTS.find(p=>p.id===productId);
    const content=$('#allReviewsModalContent');
    const currentUser=JSON.parse(sessionStorage.getItem("currentUser"));
    if(!currentUser){
        content.innerHTML=`<p style="text-align: center;">Log in to see your reviews.</p>`;
        document.body.classList.add('no-scroll');
        const overlay=$('#allReviewsModalOverlay');
        overlay.style.display='block';
        overlay.classList.add('active');
        return;
    }
    const userProductReviews=Object.values(REVIEWS).flatMap(orderReviews=>Object.entries(orderReviews)).filter(([id,review])=>id===productId&&review.userName===currentUser.first_name).map(([_,review])=>review);
    if(userProductReviews.length===0){
        content.innerHTML=`<p style="text-align: center;">You have not yet rated this product.</p>`;
    }else{
        content.innerHTML=`<h3>${product.title} - Your Reviews</h3><div class="review-item-list">${userProductReviews.map(review=>`<div class="review-item"><div class="review-item-header"><strong>${review.userName}</strong><div class="star-rating">${getStarRatingHTML(review.rating)}</div></div><div class="review-item-date">${review.date}</div></div>`).join('')}</div>`;
    }
    document.body.classList.add('no-scroll');
    const overlay=$('#allReviewsModalOverlay');
    overlay.style.display='block';
    overlay.classList.add('active');
}

function closeAllReviewsModal(){
    document.body.classList.remove('no-scroll');
    const overlay=$('#allReviewsModalOverlay');
    if(overlay){
        overlay.classList.remove('active');
        setTimeout(()=>overlay.style.display='none',300);
    }
}

function showRatingPopover(product,buttonElement){
    event.stopPropagation();
    const popover=buttonElement.closest('.product-rating').querySelector('.rating-popover');
    if(popover.style.display==='block'){
        popover.style.display='none';
        currentlyOpenRatingPopover=null;
    }else{
        if(currentlyOpenRatingPopover){
            const openPopover=$(`[data-product-id="${currentlyOpenRatingPopover}"] .rating-popover, #detailsRatingPopover`);
            if(openPopover)openPopover.style.display='none';
        }
        popover.style.display='block';
        currentlyOpenRatingPopover=product.id;
    }
}

function closeAllPopovers(){
    $$('.rating-popover').forEach(popover=>{
        popover.style.display='none';
    });
    currentlyOpenRatingPopover=null;
}
// --- rating & review ---
function requireLogin(actionCallback,message="You need to log in to access this feature."){
    const isLoggedIn=sessionStorage.getItem("isLoggedIn")==="true";
    if(isLoggedIn){
        actionCallback();
    }else{
        showConfirmation("Do you want to log in?",openLoginModal,message+" Would you like to log in now?");
    }
}

function updateLoginStatus(){
    const user=JSON.parse(sessionStorage.getItem("currentUser"));
    const loginBtnContainer=$("#loginBtnContainer");
    if(!loginBtnContainer)return;
    if(user){
        loginBtnContainer.innerHTML=`<div class="profile-container" id="profileContainer"><button class="profile-btn"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg><span>${user.first_name}</span><svg class="arrow-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/></svg></button><div class="profile-dropdown-content" id="profileDropdown"><div class="dropdown-header">Hello, <span>${user.first_name}</span></div><a href="#" id="myProfileLink"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-user"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>My Profile</a><a href="my_orders.html"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-box"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.31 12 11 20.73 6.31"></polyline><line x1="12" y1="22.77" x2="12" y2="11"></line></svg>Orders</a><a href="wishlist.html"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-heart"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>Wishlist</a><a href="#" id="logoutBtn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-log-out"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>Logout</a></div></div>`;
        const profileContainer=$('#profileContainer');
        const profileDropdown=$('#profileDropdown');
        profileContainer.addEventListener('mouseenter',()=>{
            profileDropdown.classList.add('show');
        });
        profileContainer.addEventListener('mouseleave',()=>{
            profileDropdown.classList.remove('show');
        });
        $('#logoutBtn').addEventListener('click',(e)=>{
            e.preventDefault();
            logout();
        });
        $('#myProfileLink').addEventListener('click',(e)=>{
            e.preventDefault();
            openMyProfileModal();
        });
    }else{
        loginBtnContainer.innerHTML=`<a href="#" class="nav-link" id="profileBtn"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>Login</a>`;
        $('#profileBtn').addEventListener('click',(e)=>{
            e.preventDefault();
            openLoginModal();
        });
    }
}

function logout(){
    if(!sessionStorage.getItem("currentUser")){
        showToast("You are already logged out.",true);
        return;
    }
    saveCartToStorage();
    sessionStorage.clear();
    CART=[];
    WISHLIST=[];
    HIDDEN_ORDER_IDS=[]; // Clear hidden orders on logout
    loadCartFromStorage();
    loadWishlistFromStorage();
    updateLoginStatus();
    showToast("Successfully logged out.");
    window.location.reload();
}

function createLoginModal(){
    if($('#loginModalOverlay'))return;
    const eyeIcon=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="m10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/><path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/></svg>`;
    document.body.insertAdjacentHTML('beforeend',`<div id="loginModalOverlay" class="modal-overlay"><div class="login-modal-content"><div class="login-modal-header"><h3 id="loginModalTitle">Log In</h3><button class="modal-close-button" onclick="closeLoginModal()">&times;</button></div><div id="modalLoginFormContainer" class="form-container"><form id="modalLoginForm"><div class="login-form-group"><label for="modalLoginEmail">Email:</label><input type="email" id="modalLoginEmail" required></div><div class="login-form-group"><label for="modalLoginPassword">Password:</label><div class="password-wrapper"><input type="password" id="modalLoginPassword" required><span class="toggle-password">${eyeIcon}</span></div></div><button type="submit" class="login-button">Log In</button></form><p class="toggle-form-text">Don't have an account? <a href="#" id="modalShowRegister">Sign Up</a></p></div><div id="modalRegisterFormContainer" style="display: none;" class="form-container"><form id="modalRegisterForm"><div class="login-form-group"><label for="modalRegisterFirstName">First Name:</label><input type="text" id="modalRegisterFirstName" required></div><div class="login-form-group"><label for="modalRegisterLastName">Last Name:</label><input type="text" id="modalRegisterLastName" required></div><div class="login-form-group"><label for="modalRegisterEmail">Email:</label><input type="email" id="modalRegisterEmail" required></div><div class="login-form-group"><label for="modalRegisterPassword">Password:</label><div class="password-wrapper"><input type="password" id="modalRegisterPassword" required><span class="toggle-password" data-target="modalRegisterPassword">${eyeIcon}</span></div></div><div class="login-form-group"><label for="modalRegisterConfirmPassword">Confirm Password:</label><div class="password-wrapper"><input type="password" id="modalRegisterConfirmPassword" required><span class="toggle-password" data-target="modalRegisterConfirmPassword">${eyeIcon}</span></div></div><button type="submit" class="login-button">Sign Up</button></form><p class="toggle-form-text">Already have an account? <a href="#" id="modalShowLogin">Log In</a></p></div></div></div>`);
    $('#loginModalOverlay .login-modal-content').addEventListener('click',(e)=>e.stopPropagation());
    $('#modalShowRegister').onclick=(e)=>{
        e.preventDefault();
        showModalRegisterForm();
    };
    $('#modalShowLogin').onclick=(e)=>{
        e.preventDefault();
        showModalLoginForm();
    };
    $('#modalLoginForm').addEventListener('submit',handleModalLogin);
    $('#modalRegisterForm').addEventListener('submit',handleModalRegister);
    $$('.toggle-password').forEach(toggle=>{
        toggle.onclick=function(){
            const passwordInput=this.previousElementSibling;
            if(passwordInput){
                const type=passwordInput.getAttribute('type')==='password'?'text':'password';
                passwordInput.setAttribute('type',type);
                this.innerHTML=type==='password'?'👁️':'🔒';
            }
        };
    });
}

function openLoginModal(){
    createLoginModal();
    $('#modalLoginForm')?.reset();
    $('#modalRegisterForm')?.reset();
    document.body.classList.add('no-scroll');
    $('#loginModalOverlay').style.display='flex';
    showModalLoginForm();
}

function closeLoginModal(){
    document.body.classList.remove('no-scroll');
    if($('#loginModalOverlay')){
        $('#loginModalOverlay').style.display='none';
        $('#modalLoginForm')?.reset();
        $('#modalRegisterForm')?.reset();
    }
}

function showModalLoginForm(){
    $('#modalRegisterForm')?.reset();
    $("#loginModalTitle").textContent='Log In';
    $("#modalLoginFormContainer").style.display='block';
    $("#modalRegisterFormContainer").style.display='none';
}

function showModalRegisterForm(){
    $('#modalLoginForm')?.reset();
    $("#loginModalTitle").textContent='Sign Up';
    $("#modalLoginFormContainer").style.display='none';
    $("#modalRegisterFormContainer").style.display='block';
}

async function handleModalLogin(e){
    e.preventDefault();
    const email=document.getElementById('modalLoginEmail').value;
    const password=document.getElementById('modalLoginPassword').value;
    const loginButton=e.target.querySelector('button[type="submit"]');
    loginButton.disabled=true;
    try{
        // 🚩 FIX: Removed localhost, using relative path
        const res=await fetch("/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
        if(!res.ok){
            const errorText=await res.text();
            console.error("Login Error:",res.status,errorText);
            if(res.status===401){
                showToast("Invalid email or password.",true);
            }else{
                showToast("Something went wrong. Please try again later.",true);
            }
            return;
        }
        const data=await res.json();
        if(data.status==="success"){
            const anonymousCart=JSON.parse(sessionStorage.getItem('cart_anonymous')||'[]');
            if(anonymousCart.length>0){
                const userEmail=data.user.email;
                let userCart=JSON.parse(localStorage.getItem(`cart_${userEmail}`)||'[]');
                anonymousCart.forEach(anonItem=>{
                    const existingItem=userCart.find(userItem=>userItem.cartId===anonItem.cartId);
                    if(existingItem){
                        existingItem.qty+=anonItem.qty;
                    }else{
                        userCart.push(anonItem);
                    }
                });
                localStorage.setItem(`cart_${userEmail}`,JSON.stringify(userCart));
                sessionStorage.removeItem('cart_anonymous');
            }
            sessionStorage.setItem("isLoggedIn","true");
            sessionStorage.setItem("currentUser",JSON.stringify(data.user));
            showToast("Login successful!");
            closeLoginModal();
            if(data.user.role==="admin"){
                window.location.href="/admin.html";
            }else{
                window.location.reload();
            }
        }else{
            showToast(data.message||"Invalid email or password.",true);
        }
    }catch(err){
        console.error("Login Error:",err);
        showToast("Something went wrong. Please try again later.",true);
    }finally{
        loginButton.disabled=false;
    }
}

async function handleModalRegister(e){
    e.preventDefault();
    const first_name=$('#modalRegisterFirstName').value.trim();
    const last_name=$('#modalRegisterLastName').value.trim();
    const email=$('#modalRegisterEmail').value;
    const password=$('#modalRegisterPassword').value;
    const confirmPassword=$('#modalRegisterConfirmPassword').value;
    if(password!==confirmPassword){
        showToast("Passwords do not match!",true);
        return;
    }
    try{
        // 🚩 FIX: Removed localhost, using relative path
        const res=await fetch("/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({first_name,last_name,email,password})});
        const data=await res.json();
        if(data.status==="success"){
            showToast("Registration successful! Please log in.");
            showModalLoginForm();
        }else{
            showToast(data.message||"Registration failed.",true);
        }
    }catch(err){
        console.error("Register Error:",err);
        showToast("Something went wrong. Please try again later.",true);
    }
}
// --- login register ---
function createMyProfileModal(){
    if($('#myProfileModalOverlay'))return;
    document.body.insertAdjacentHTML('beforeend',`<div id="myProfileModalOverlay" class="modal-overlay"><div class="login-modal-content"><div class="login-modal-header"><h3>My Profile</h3><button class="modal-close-button" onclick="closeMyProfileModal()">&times;</button></div><div id="myProfileContent" class="form-container"></div></div></div>`);
    $('#myProfileModalOverlay').addEventListener('click',closeMyProfileModal);
    $('#myProfileModalOverlay .login-modal-content').addEventListener('click',(e)=>e.stopPropagation());
}

function openMyProfileModal(){
    const user=JSON.parse(sessionStorage.getItem("currentUser"));
    if(!user){
        openLoginModal();
        return;
    }
    createMyProfileModal();
    const profileContent=$('#myProfileContent');
    profileContent.innerHTML=`<div class="login-form-group"><label>Name:</label><p>${(user.first_name||'')+' '+(user.last_name||'')}</p></div><div class="login-form-group"><label>Email:</label><p>${user.email||''}</p></div>`;
    document.body.classList.add('no-scroll');
    $('#myProfileModalOverlay').style.display='flex';
}

function closeMyProfileModal(){
    document.body.classList.remove('no-scroll');
    if($('#myProfileModalOverlay')){
        $('#myProfileModalOverlay').style.display='none';
    }
}
// --- my profilr ---
function createServicesModal(){
    if($('#servicesModalOverlay'))return;
    document.body.insertAdjacentHTML('beforeend',`<div id="servicesModalOverlay" class="modal-overlay"><div class="login-modal-content"><div class="login-modal-header"><h3>My Services</h3><button class="modal-close-button" onclick="closeServicesModal()">&times;</button></div><div id="servicesContent" class="form-container"><div class="service-device-selector"><h4>Select Device</h4><div class="device-buttons"><button class="device-btn active">Mobile</button><button class="device-btn">Laptop</button></div></div><h4>Services We Offer</h4><ul class="services-list"><li><span class="service-icon">💾</span> Data Recovery</li><li><span class="service-icon">☣️</span> Virus & Malware Removal</li><li><span class="service-icon">⚙️</span> Software Troubleshooting</li><li><span class="service-icon">📱</span> Screen Repair</li><li><span class="service-icon">🔋</span> Battery Replacement</li></ul><p style="text-align:center; margin-top: 20px; font-size: 14px;">Contact support for details and pricing.</p></div></div></div>`);
    $('#servicesModalOverlay').addEventListener('click',closeServicesModal);
    $('#servicesModalOverlay .login-modal-content').addEventListener('click',(e)=>e.stopPropagation());
    $$('#servicesModalOverlay .device-btn').forEach(btn=>{
        btn.onclick=()=>{
            $$('#servicesModalOverlay .device-btn').forEach(b=>b.classList.remove('active'));
            btn.classList.add('active');
        };
    });
}

function openServicesModal(){
    createServicesModal();
    document.body.classList.add('no-scroll');
    $('#servicesModalOverlay').style.display='flex';
}

function closeServicesModal(){
    document.body.classList.remove('no-scroll');
    if($('#servicesModalOverlay')){
        $('#servicesModalOverlay').style.display='none';
    }
}

function initServicePage(){
    const form=$("#serviceForm");
    const thankYouContainer=$("#thankYouContainer");
    const formContainer=$("#serviceFormContainerNew");
    if(!form)return;
    form.addEventListener("submit",async(event)=>{
        event.preventDefault();
        const serviceData={
            name:$("#serviceCustomerName").value,
            phone:$("#serviceContact").value,
            email:$("#serviceEmail").value||null,
            deviceType:$("#deviceType").value,
            model:$("#serviceModel").value||null,
            issue:$("#serviceIssue").value
        };
        try{
            // 🚩 FIX: Removed localhost, using relative path
            const response=await fetch("/api/services",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(serviceData)});
            const result=await response.json();
            if(response.ok){
                console.log("Service request submitted:",result);
                formContainer.style.display='none';
                thankYouContainer.style.display='block';
            }else{
                console.error("Failed to submit service request:",result.error);
                showToast("Failed to submit request. Please try again.",true);
            }
        }catch(error){
            console.error("Network error:",error);
            showToast("A network error occurred. Please try again later.",true);
        }
    });
}
// --- service ---
function getWishlistKey(){
    return`wishlist_${JSON.parse(sessionStorage.getItem("currentUser"))?.email||'anonymous'}`;
}

function saveWishlistToStorage(){
    localStorage.setItem(getWishlistKey(),JSON.stringify(WISHLIST));
}

function loadWishlistFromStorage(){
    const user=JSON.parse(sessionStorage.getItem("currentUser"));
    if(user){
        WISHLIST=JSON.parse(localStorage.getItem(getWishlistKey())||'[]');
    }else{
        WISHLIST=[];
    }
    updateWishlistCount();
}

function isProductInWishlist(productId){
    return WISHLIST.some(item=>item.id===productId);
}

function updateWishlistCount(){
    const badge=$("#wishlistCountBadge");
    if(badge){
        badge.textContent=WISHLIST.length;
        badge.style.display=WISHLIST.length>0?'flex':'none';
    }
}

function toggleWishlist(event,productId){
    event.stopPropagation();
    requireLogin(()=>{
        const product=PRODUCTS.find(p=>p.id===productId);
        if(!product)return;
        const index=WISHLIST.findIndex(item=>item.id===productId);
        if(index>-1){
            WISHLIST.splice(index,1);
            showToast(`${product.title} removed from wishlist.`);
        }else{
            WISHLIST.push(product);
            showToast(`${product.title} added to wishlist.`);
        }
        saveWishlistToStorage();
        updateWishlistCount();
        const path=window.location.pathname;
        if(path.includes('shop.html'))renderFiltered();
        if(path.includes('wishlist.html'))initWishlistPage();
        if(!$('#detailsOverlay')?.hidden&&modalState.product.id===productId){
            const btn=$('#detailsOverlay .wishlist-btn');
            if(btn)btn.classList.toggle('wishlisted',isProductInWishlist(productId));
        }
    },"You need to log in to access this feature.");
}

function createWishlistCard(p){
    const mainImage=(p.images&&p.images.length>0)?p.images[0]:'https://placehold.co/100x100/e0e0e0/757575?text=No+Image';
    
    let displayPrice=p.price;
    let mrpPrice=p.mrp_price;
    if (['mobiles', 'laptops', 'seconds'].includes(p.category) && p.variants && p.variants.length > 0) {
        displayPrice=p.variants[0].price;
        mrpPrice=p.variants[0].mrp_price;
    }
    
    const priceHTML=renderPriceHTML(displayPrice,mrpPrice);
    return`<div class="wishlist-item-compact"><div class="wishlist-item-image-container"><img src="${mainImage}" alt="${p.title}" class="wishlist-item-img"/></div><div class="wishlist-item-details-container"><div class="item-info"><h4 class="item-title">${p.title}</h4><div class="item-price-row">${priceHTML}</div></div><div class="item-actions"><button class="btn small primary" onclick="openDetails(PRODUCTS.find(pr => pr.id === '${p.id}'))">View Details</button><button class="btn small danger remove-btn" onclick="toggleWishlist(event, '${p.id}')">Remove</button></div></div></div>`;
}

function initWishlistPage(){
    const wishlistSection=$('#wishlistSection');
    if(!wishlistSection)return;
    if(WISHLIST.length===0){
        wishlistSection.innerHTML=`<div class="empty-wishlist-container"><img src="https://rukminim2.flixcart.com/www/800/800/promos/16/05/2019/d438a32e-765a-4d8b-b4a6-520b560971e8.png?q=90" alt="Empty Wishlist"><h2>Your wishlist is empty!</h2><p>Start adding products you love to your wishlist.</p><a href="shop.html" class="shop-now-btn">Shop Now</a></div>`;
        return;
    }
    const wishlistItemsHtml=WISHLIST.map(p=>createWishlistCard(p)).join('');
    wishlistSection.innerHTML=`<div class="wishlist-container"><h2>My Wishlist (${WISHLIST.length} items)</h2><div class="wishlist-items-list">${wishlistItemsHtml}</div></div>`;
}
// --- wishlist ---
function addShopPageMenuButton(){
    // Find the products display title element on the shop page
    const productsDisplayTitleElement = $('#productsDisplayTitle');
    
    // Check if the title element exists and we are on the shop page
    if(!productsDisplayTitleElement || !window.location.pathname.endsWith('shop.html')) return;
    
    // Find the shop filter bar (where the button should be placed next to the search bar)
    const shopFilterBar = $('.shop-filter-bar');
    if (!shopFilterBar) return;
    
    // Create the new menu button for the shop page
    const menuButton = document.createElement('button');
    // Using the class defined in CSS for the 3-bar icon
    menuButton.className = 'menu-toggle-btn'; 
    menuButton.innerHTML = '&#9776;'; // 3-bar icon
    menuButton.title = 'Show Categories';

    // Remove any existing toggle button in the filter bar
    const existingButton = shopFilterBar.querySelector('.menu-toggle-btn');
    if (existingButton) {
        existingButton.remove();
    }
    
    // **NEW LOGIC (Change 3): Prepend the button to the shop-filter-bar**
    shopFilterBar.prepend(menuButton);

    // Attach the event listener
    menuButton.onclick = openCategoryPanel;
    
    // The title element should naturally flow beneath the filter bar since the filter bar is the flex container. 
    // If the title is still wrapped, no change is needed to the title itself.
}
// --- about us conatct us ---
async function initializeApp(){
    injectCSS();
    await fetchProducts();
    await fetchAdvertisements(); // NEW: Fetch advertisement data
    loadData();
    updateLoginStatus();
    updateCartCount();
    updateWishlistCount();
    displayLatestProducts();
    
    // =================================================================
    // ✅ MOBILE MENU TOGGLE LOGIC (REQUIRED FOR MOBILE RESPONSIVENESS)
    // =================================================================
    // REMOVED: Header menu toggle button logic as it's no longer needed in the header/nav.
    const mainNav = $('#mainNav'); // Assuming your <nav> element has the ID 'mainNav'
    const headerToggleBtn = $('#menuToggleBtn');
    
    // Clean up old header button if it exists in the HTML
    if (headerToggleBtn) {
        headerToggleBtn.remove();
    }
    
    if (mainNav) {
        // Since the toggle button is now external on the shop page, we handle the mobile nav closure separately
        
        // Close menu when a link is clicked
        $$('#mainNav a').forEach(link => {
             link.addEventListener('click', () => {
                if (mainNav.classList.contains('mobile-open')) {
                    mainNav.classList.remove('mobile-open');
                    document.body.classList.remove('no-scroll');
                }
             });
        });
    }
    // =================================================================
    
    
    $('#header-search-form')?.addEventListener('submit',(e)=>{
        e.preventDefault();
        const searchTerm=$('#headerSearchInput').value;
        if(searchTerm){
            window.location.href=`shop.html?q=${encodeURIComponent(searchTerm)}`;
        }
    });
    
    // REMOVED: The old way of getting the menu button for the shop page
    /*
    const menuToggleBtnShop=$('#shopPage .menu-toggle-btn');
    if(menuToggleBtnShop){
        menuToggleBtnShop.onclick=openCategoryPanel;
    }
    */
    
    const myOrdersLink=document.querySelector('a[href="my_orders.html"]');
    if(myOrdersLink){
        myOrdersLink.addEventListener('click',(e)=>{
            e.preventDefault();
            requireLogin(()=>{
                window.location.href=myOrdersLink.href;
            },"You need to log in to view your orders.");
        });
    }
    document.addEventListener("click",(e)=>{
        const profileDropdown=$('#profileDropdown');
        const profileBtn=$('#profileContainer'); // Use container for mouse leave/enter logic
        if(profileDropdown&&profileBtn&&!profileDropdown.contains(e.target)&&!profileBtn.contains(e.target)){
            profileDropdown.classList.remove('show');
        }
        if(!e.target.closest('.rating-popover')&&!e.target.closest('.rating-details-btn')){
            closeAllPopovers();
        }
        const categoryPanelModal=$('#category-panel-modal');
        const categoryPanelContent=$('.category-panel-content');
        const menuToggleBtn=$('.menu-toggle-btn');
        if(categoryPanelModal&&categoryPanelModal.classList.contains('active')&&!categoryPanelContent.contains(e.target)&&!menuToggleBtn.contains(e.target)){
            closeCategoryPanel();
        }
    });
    
    window.addEventListener('keydown',(event)=>{
        if(event.key==='Escape'){
            if($("#detailsOverlay")&&!$("#detailsOverlay").hidden){
                closeDetails();
            }
            if($('#loginModalOverlay')&&$('#loginModalOverlay').style.display!=='none'){
                closeLoginModal();
            }
            if($('#myProfileModalOverlay')&&$('#myProfileModalOverlay').style.display!=='none'){
                closeMyProfileModal();
            }
            if($('#ratingAndReviewModalOverlay')&&$('#ratingAndReviewModalOverlay').style.display!=='none'){
                closeRatingAndReviewModal();
            }
            if($('#allReviewsModalOverlay')&&$('#allReviewsModalOverlay').style.display!=='none'){
                closeAllReviewsModal();
            }
            if($('#confirmationModalOverlay')&&$('#confirmationModalOverlay').style.display!=='none'){
                closeConfirmationModal();
            }
            if($('#servicesModalOverlay')&&$('#servicesModalOverlay').style.display!=='none'){
                closeServicesModal();
            }
            if($('#category-panel-modal')&&$('#category-panel-modal').classList.contains('active')){
                closeCategoryPanel();
            }
            closeAllPopovers();
        }
    });
    const path=window.location.pathname;
    if(path.endsWith('/')||path.endsWith('index.html'))initHomePage();
    else if(path.endsWith('shop.html')){
        // NEW: Call the function to place the button correctly on the shop page
        addShopPageMenuButton(); 
        initShopPage();
        // REMOVED GRID CLASS ADDITION: $('#productsGrid').classList.add('layout-5-col');
    }else if(path.endsWith('cart.html')){
        loadCartFromStorage();
        initCartPage();
    }else if(path.endsWith('wishlist.html'))initWishlistPage();
    else if(path.endsWith('billing.html'))initBillingPage();
    else if(path.endsWith('order.html'))initOrderPage();
    else if(path.endsWith('my_orders.html')){
        requireLogin(initMyOrdersPage,"You need to log in to view your orders.");
    }else if(path.endsWith('service.html')){
        initServicePage();
    }
    const phoneInput=$('#customerPhone');
    const pincodeInput=$('#customerPincode');
    if(phoneInput){
        phoneInput.addEventListener('input',function(e){
            const originalValue=this.value;
            const sanitizedValue=originalValue.replace(/[^0-9]/g,'');
            if(originalValue!==sanitizedValue){
                showToast("Only numbers are allowed.",true);
            }
            this.value=sanitizedValue;
        });
    }
    if(pincodeInput){
        pincodeInput.addEventListener('input',function(e){
            const originalValue=this.value;
            const sanitizedValue=originalValue.replace(/[^0-9]/g,'');
            if(originalValue!==sanitizedValue){
                showToast("Only numbers are allowed.",true);
            }
            this.value=sanitizedValue;
        });
    }
}

document.addEventListener("DOMContentLoaded",initializeApp);
