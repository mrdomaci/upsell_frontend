let us_cart_items_gids = [];
let lastRenderedProductIds = [];
let us_in_progress = false;
checkCart();

async function getRecommnededProductsFromServer(us_cart_items) {
    if (shouldCallServer(us_cart_items) === false) {
        return null;
    }
    const us_project_id = getShoptetDataLayer('projectId');
    const us_project_id_modulo = us_project_id % 11;
    try {
        const response = await fetch('https://slabihoud.cz/products/' + us_project_id + '/' + us_project_id_modulo + '/' + us_cart_items.toString());
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
    }
}

function shouldCallServer(us_cart_items) {
    if (us_cart_items.length == 0) {
        return false;
    }

    if (sessionStorage.getItem('us_request_' + us_cart_items.toString()) != null) {
        return false;
    }
    return true;
}

function getCartItemsGUIDS() {
    let us_result_items = [];
    const us_cart_items = getCartItems();
    us_cart_items.forEach(function (el) {
        us_result_items.push(el.getAttribute('data-micro-identifier'));
    });
    us_result_items.sort();
    return us_result_items;
}

function getCartItems() {
    return document.querySelectorAll('[data-micro-identifier]:not([data-source="easy-upsell"])');
}

function getImageCdn() {
    const us_cart_items = document.querySelectorAll('td.cart-p-image a img');
    if (us_cart_items.length > 0) {
        let us_image_src = us_cart_items[0].getAttribute('data-src') || us_cart_items[0].getAttribute('src');
        if (!us_image_src) return null;
        const us_image_parts = us_image_src.split('/');
        us_image_parts.pop();
        const us_image_cdn = us_image_parts.join('/');
        return us_image_cdn + '/';
    }
}

function initializeScript() {
    getResults();
    setInterval(getResults, 2000);
}

function isCart() {
    if (getShoptetDataLayer('pageType') == 'cart') {
        return true;
    }
    return false;
}

function checkCart() {
    if (!isCart()) {
        setTimeout(checkCart, 5000);
        return;
    }
    initializeScript();
}

async function getResults() {
    setMainDiv();
    const us_cart_items = getCartItemsGUIDS();
    if (arraysAreEqual(us_cart_items, us_cart_items_gids)) {
        return;
    }
    if (us_in_progress) {
        return;
    }
    us_in_progress = true;
    us_cart_items_gids = us_cart_items;
    const result = await getRecommnededProductsFromServer(us_cart_items);
    if (result != null) {
        await cacheResults(result);
        await cacheRequest(us_cart_items, result);
    }
    printResults();
    us_in_progress = false;
}

function setMainDiv() {
    const us_main_div = document.querySelectorAll('#upsell-container');
    if (us_main_div.length == 0) {
        const us_cart = document.querySelectorAll('.cart-table');
        if (us_cart.length > 0) {
            us_cart.forEach(function (el) {
                el.insertAdjacentHTML('afterend', '<hr><div id="upsell-container"></div>');
            });
        }
    }
}

async function cacheResults(result) {
    result.recommendations.forEach(async function (recommendation) {
        recommendation = await getVariantDetailFromEshop(recommendation);
        let recommendationJson = JSON.stringify(recommendation);
        if (recommendationJson != null) {
            sessionStorage.setItem('us_' + recommendation.id, recommendationJson.toString());
        }
    });
    return true;
}

async function getVariantDetailFromEshop(recommendation)
{
    const us_link_response = await fetchURL(insertCacheInUrl(recommendation.url));
    const response = await us_link_response.text();
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = response;
    const availability = tempContainer.querySelector('span.availability-label');
    recommendation.availability = '';
    if (availability) {
        recommendation.availability = availability.textContent.trim();
    }
    const product_id = tempContainer.querySelector('input[name="productId"]');
    if (product_id) {
        recommendation.id = product_id.getAttribute('value');
    } else {
        return null;
    }
    const price_id = tempContainer.querySelector('input[name="priceId"]');
    if (price_id) {
        recommendation.priceId = price_id.getAttribute('value');
    } else {
        return null;
    }
    const price = tempContainer.querySelector('span.price-final-holder')
    if (price) {
        recommendation.price = price.textContent.trim();
    } else {
        return null;
    }
    return recommendation;
}

async function fetchURL(url) {
    try {
        const response = await fetch(url);
        return response;
    } catch (error) {
        console.error('Error:', error);
    }
}

async function cacheRequest(us_cart_items, result) {
    let us_recommendation_ids = [];
    result.recommendations.forEach(element => {
        us_recommendation_ids.push(element.id);
    });
    sessionStorage.setItem('us_request_' + us_cart_items.toString(), us_recommendation_ids.toString());
    sessionStorage.setItem('us_header', result.header);
    return true;
}

function checkCachedData(us_product_ids) {
    let us_result = true;
    us_product_ids.forEach(function (product_id) {
        if (sessionStorage.getItem('us_' + product_id) == null) {
            us_result = false;
        }
    });
    return us_result;
}

function printResults() {
    const upsellContainer = document.querySelector('#upsell-container');
    if (!upsellContainer) return;

    const usImageCdn = getImageCdn();
    let usLanguage = getShoptetDataLayer('language');
    let usCallToAction = shoptet.messages['toCart'];

    let usRequest = sessionStorage.getItem('us_request_' + getCartItemsGUIDS().toString());
    let usProductIds = usRequest ? usRequest.split(',') : [];

    if (JSON.stringify(usProductIds) === JSON.stringify(lastRenderedProductIds)) {
        return;
    }

    if (usProductIds.length > 0 && checkCachedData(usProductIds)) {
        let usHeader = sessionStorage.getItem('us_header');

        if (!document.querySelector('#upsell-container h4')) {
            const headerElement = document.createElement('h4');
            headerElement.textContent = usHeader;
            upsellContainer.appendChild(headerElement);
        }

        let upsellTable = document.querySelector('#upsell-recommendations');
        if (!upsellTable) {
            upsellContainer.insertAdjacentHTML(
                'beforeend',
                `<table class="cart-table upsell"><tbody id="upsell-recommendations"></tbody></table>`
            );
            upsellTable = document.querySelector('#upsell-recommendations');
        }

        let existingRows = {};
        document.querySelectorAll('#upsell-recommendations tr[data-micro-identifier]').forEach(row => {
            existingRows[row.getAttribute('data-micro-identifier')] = row;
        });

        usProductIds.forEach(function (productId) {
            let recommendation = sessionStorage.getItem('us_' + productId);
            if (recommendation) {
                recommendation = JSON.parse(recommendation);

                if (existingRows[recommendation.guid]) {
                    let row = existingRows[recommendation.guid];
                    row.querySelector('.p-name a').textContent = recommendation.name;
                    row.querySelector('.p-name a').href = recommendation.url;
                    row.querySelector('.cart-p-image img').src = usImageCdn + recommendation.image_url;
                    row.querySelector('.cart-p-image img').alt = recommendation.name;
                    row.querySelector('.p-availability strong').textContent = recommendation.availability;
                    row.querySelector('.p-total strong').textContent = recommendation.price;
                    row.querySelector('.p-total .unit-value').textContent = `/ ${recommendation.unit}`;
                } else {
                    let usResultItem = `
                        <tr class="removeable" data-micro="cartItem" data-source="easy-upsell" data-micro-identifier="${recommendation.guid}" data-micro-sku="${recommendation.code}" data-testid="productItem_${recommendation.guid}">
                            <td class="cart-p-image"><a href="${recommendation.url}"><img src="${usImageCdn}${recommendation.image_url}" alt="${recommendation.name}"></a></td>
                            <td class="p-name"><a href="${recommendation.url}" class="main-link">${recommendation.name}</a></td>
                            <td class="p-availability"><strong class="availability-label">${recommendation.availability}</strong></td>
                            <td class="p-quantity">
                                <form action="/action/Cart/addCartItem/" method="post" class="pr-action csrf-enabled">
                                    <input type="hidden" name="language" value="${usLanguage}">
                                    <input type="hidden" name="priceId" value="${recommendation.priceId}">
                                    <input type="hidden" name="productId" value="${recommendation.id}">
                                    <input type="hidden" name="amount" value="1">
                                    <button type="submit" class="btn btn-cart add-to-cart-button">
                                        <span>${usCallToAction}</span>
                                    </button>
                                </form>
                            </td>
                            <td class="p-total"><strong class="price-final">${recommendation.price}</strong><span class="unit-value">/ ${recommendation.unit}</span></td>
                        </tr>`;
                    upsellTable.insertAdjacentHTML('beforeend', usResultItem);
                }
            }
        });

        lastRenderedProductIds = [...usProductIds];
    }
}

function insertCacheInUrl(url) {
    const urlParts = url.split('/');
    if (urlParts.length > 2) {
        urlParts.splice(3, 0, 'cache');
    }
    return urlParts.join('/');
}

function arraysAreEqual(array1, array2) {
    if (array1.length !== array2.length) {
        return false;
    }

    for (let i = 0; i < array1.length; i++) {
        if (array1[i] !== array2[i]) {
            return false;
        }
    }
    
    return true;
}
