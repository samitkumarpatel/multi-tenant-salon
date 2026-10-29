import test from 'node:test';
import assert from 'node:assert/strict';
import { shopNavigation, SHOP_SECTIONS } from '../app/lib/shopNavigation.ts';

test('shop sidebar exposes exactly the four agreed sections',()=>{
 assert.deepEqual(SHOP_SECTIONS.map(s=>s.key),['orders','products','inventory','shipping']);
});
test('product-related deep links keep Products selected and expose its three tabs',()=>{
 for(const page of ['products','brands','categories']) {
  const nav=shopNavigation(`/salon-123/shop/${page}`);
  assert.equal(nav.section,'products');assert.equal(nav.page,page);
  assert.deepEqual(nav.tabs.map(tab=>tab.key),['products','brands','categories']);
 }
});
test('orders and after-sales deep links keep Orders selected, including order detail',()=>{
 for(const page of ['orders','returns','refunds','credit-notes'])assert.equal(shopNavigation(`/salon-123/shop/${page}`).section,'orders');
 assert.equal(shopNavigation('/salon-123/shop/orders/456').page,'orders');
 assert.deepEqual(shopNavigation('/salon-123/shop/returns').tabs.map(tab=>tab.key),['orders','returns','refunds','credit-notes']);
 assert.equal(shopNavigation('/salon-123/shop').page,'orders');
});
test('standalone sections do not display unrelated tabs or match other admin routes',()=>{
 for(const page of ['inventory','shipping'])assert.deepEqual(shopNavigation(`/salon-123/shop/${page}`).tabs,[]);
 for(const path of ['/salon-123/payments','/salon-123/shopper','/salon-123/shop/unknown','/salon-123/website'])assert.equal(shopNavigation(path),null);
});
