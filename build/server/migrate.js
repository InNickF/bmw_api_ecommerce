/* eslint-disable */

const server = require('./server');

const ds = server.dataSources.db;
const tables = [
  'Country',
  'State',
  'City',
  'VehicleType',
  'VehicleSerie',
  'VehicleBrand',
  'Vehicle',
  'ArticleCategory',
  'ArticleTag',
  'Article',
  'ArticleComment',
  'Slider',
  'Event',
  'EventAssistant',
  'EventComment',
  'MyUser',
  'Subscription',
  'Address',
  'Service', 
  'ProductCategory',
  'Motivator',
  'Product',
  'Image',
  'ImageCategory',
  'ImageProduct',
  'AttributeValue',
  'Attribute',
  'ProductModel',
  'VehicleModel',
  'RelatedProduct',
  'ServiceProduct',
  'Store',
  'StoreProduct',
  'OrderService',
  'Order',
  'CodeCoupon',
  'OrderStatus',
  'PaymentMethod',
  'Payment',
  'Delivery',
  'Instalation',
  'OrderDetail',
  'Access',
  'WishList',
  'UserType',
  'Card',
  'Advertisement',
  'Complement',
  'Parameter',
  'MyRole',
  'AssignedRole',
  'Permission',
  'Brand',
  'Return',
  'Pqr',
  'Reason',
  'ReasonType',
  'PqrDetail',
  'VehicleBodyWork',
  'ProductVariation',
  'ProcessLog',
  'SkuVariation',
  'UserCoupon',
  'AuditTerms',
  'CodeCouponMyUser',
  'Config'
];

ds.autoupdate(tables, err => {
  const name = ds.adapter.name;

  console.log(`working in ${name}`);
  console.log('error', err);
  if (err) throw err;

  console.log(`${name} updated`);

  ds.disconnect();

  process.exit();
});
