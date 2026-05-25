// đây là những pattern mình sẽ xóa khi middleware được call
const CACHE_INVALIDATION_PATTERNS = {
  products: [
    'products:list:*',
    'products:detail:*',
    'products:suggest:*',
    'products:recommendations:*',
    'products:explore-more:*',
    'categories:slug:*',
    'dashboard:*'
  ],

  categories: [
    'categories:tree',
    'categories:slug:*',
    'dashboard:*'
  ],

  banners: ['banners:active', 'banners:active:*'],
  widgets: ['widgets:active'],
  bankInfo: ['bankinfo:active'],
  flashSales: ['flashsales:list:*', 'flashsales:detail:*'],
  aboutContent: ['about:content:*'],
  termsContent: ['terms:content:*'],
  cooperationContactContent: ['cooperation-contact:content:*'],
  homeBuildYourKitContent: ['home-build-your-kit:content:*'],
  homeWhyChooseUsContent: ['home-why-choose-us:content:*'],
  blog: ['blog:list:*', 'blog:detail:*'],
  dashboard: ['dashboard:*']
}

module.exports = {
  CACHE_INVALIDATION_PATTERNS
}
