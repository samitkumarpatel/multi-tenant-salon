import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../worker.ts';
import { productPath, productStructuredData, jsonLd } from '../../../packages/ui-website/src/productSeo.ts';

const salon={id:'salon-1',handler:'bb',name:'BB Salon',features:['STATIC_WEBSITE','WEBSHOP'],status:'ACTIVE'};
const product={id:12,salonId:'salon-1',name:'Repair Shampoo',handle:'repair-shampoo',active:true,description:'Healthy hair, gentle care.',imageUrl:'https://images.test/shampoo.jpg',variants:[
  {id:21,label:'100 ml',price:12,currency:'DKK',quantityOnHand:3,active:true},
  {id:22,label:'250 ml',price:22,currency:'DKK',quantityOnHand:0,active:true},
]};
async function serve(path,options={}) {
  const calls=[];
  const fetcher=async input=>{
    const u=new URL(input);calls.push(u.pathname+u.search);
    if(options.outage) throw new Error('network failure');
    if(u.pathname.endsWith('/domain/resolve'))return Response.json({salonId:'salon-1'});
    if(u.pathname.endsWith('/website/domain'))return Response.json({hostname:options.domain??null});
    if(u.pathname.includes('/products/by-handle/'))return options.missing?new Response(null,{status:404}):Response.json({...product,...options.product});
    if(u.pathname.endsWith('/shop/products'))return Response.json(options.products??[product]);
    return Response.json({...salon,...options.salon});
  };
  const env={ASSETS:{fetch:async request=>new Response('<!doctype html><html><head></head><body><div id="spa">Loading</div><script src="/assets/app.js"></script></body></html>')}};
  return {response:await handleRequest(new Request(`${options.origin??'https://bb.salonsaas.org'}${path}`,{method:options.method??'GET'}),env,fetcher),calls};
}

test('handles produce clean URLs and discard private checkout and account parameters',()=>{
  assert.equal(productPath('repair-shampoo','?slug=bb&lang=da&renew=private&payment=success&tab=points&variant=21'),'/shop/products/repair-shampoo?slug=bb&lang=da');
});
test('product requests contain usable HTML, canonical metadata and accurate variant offers before JavaScript',async()=>{
  const {response}=await serve('/shop/products/repair-shampoo?variant=22');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/<h1>Repair Shampoo<\/h1>/);
  assert.match(html,/rel="canonical" href="https:\/\/bb.salonsaas.org\/shop\/products\/repair-shampoo"/);
  assert.match(html,/property="og:image"/);
  assert.match(html,/Out of stock/);
  assert.match(html,/src="\/assets\/app.js"/);
  const data=JSON.parse(html.match(/type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(data.offers[1].availability,'https://schema.org/OutOfStock');
  assert.equal(data.offers[0].priceCurrency,'DKK');
  assert.equal(data.offers[0].price,'12');
  assert.equal(response.headers.get('Cache-Control'),'no-store');
});
test('renamed handles redirect permanently and preserve only public variant/language context',async()=>{
  const {response}=await serve('/shop/products/old-name?variant=22&lang=da&renew=secret&payment=success');
  assert.equal(response.status,301);
  assert.equal(response.headers.get('Location'),'https://bb.salonsaas.org/shop/products/repair-shampoo?variant=22&lang=da');
});
test('custom domains are resolved independently of arbitrary slug query parameters',async()=>{
  const {response,calls}=await serve('/shop/products/repair-shampoo?slug=another-salon',{origin:'https://shop.example.com',domain:'shop.example.com'});
  assert.equal(response.status,200);
  assert.ok(calls.includes('/api/salon/domain/resolve?hostname=shop.example.com'));
  assert.ok(calls.includes('/api/salon/salon-1'));
  assert.ok(!calls.some(value=>value.includes('another-salon')));
  assert.match(await response.text(),/https:\/\/shop.example.com\/shop\/products\/repair-shampoo/);
});
test('tenant aliases redirect to the preferred custom domain',async()=>{
  const {response}=await serve('/shop/products/repair-shampoo',{domain:'shop.example.com'});
  assert.equal(response.status,301);
  assert.equal(response.headers.get('Location'),'https://shop.example.com/shop/products/repair-shampoo');
});
test('missing, disabled and unpublished pages have real 404 responses; outages are retryable 503',async()=>{
  for(const options of [{missing:true},{product:{active:false}},{product:{variants:[]}},{salon:{status:'DISABLED'}},{salon:{features:['STATIC_WEBSITE']}}]){
    const {response}=await serve('/shop/products/repair-shampoo',options);
    assert.equal(response.status,404);
    assert.match(await response.text(),/name="robots" content="noindex"/);
  }
  assert.equal((await serve('/shop/products/repair-shampoo',{outage:true})).response.status,503);
});
test('sitemaps and shop HTML expose current product links, including out-of-stock products',async()=>{
  const {response}=await serve('/sitemap.xml',{products:[product,{...product,id:13,handle:'inactive',active:false}]});
  const xml=await response.text();
  assert.match(xml,/https:\/\/bb.salonsaas.org\/shop\/products\/repair-shampoo/);
  assert.doesNotMatch(xml,/inactive/);
  const shop=await serve('/shop');
  assert.match(await shop.response.text(),/<a href="\/shop\/products\/repair-shampoo">Repair Shampoo<\/a>/);
  const robots=await serve('/robots.txt');
  assert.match(await robots.response.text(),/Sitemap: https:\/\/bb.salonsaas.org\/sitemap.xml/);
});
test('product text cannot inject executable markup or terminate JSON-LD script elements',async()=>{
  const name='</script><img src=x onerror=alert(1)>';
  const {response}=await serve('/shop/products/repair-shampoo',{product:{name,description:name}});
  const html=await response.text();
  assert.doesNotMatch(html,/<img src=x/);
  assert.match(html,/&lt;\/script&gt;/);
  assert.match(jsonLd(productStructuredData({...product,name},salon,'https://bb.salonsaas.org/shop/products/repair-shampoo')),/\\u003c/);
});
test('static assets bypass API fetches; HEAD and unsupported methods are handled safely',async()=>{
  const asset=await serve('/assets/app.js');assert.equal(asset.calls.length,0);
  const head=await serve('/shop/products/repair-shampoo',{method:'HEAD'});assert.equal(head.response.status,200);assert.equal(await head.response.text(),'');
  const post=await serve('/shop/products/repair-shampoo',{method:'POST'});assert.equal(post.response.status,405);
});
