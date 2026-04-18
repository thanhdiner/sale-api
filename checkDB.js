const mongoose = require('mongoose');
const Banner = require('./api/v1/models/banner.model');
const Widget = require('./api/v1/models/widgets.model');
const ProductCategory = require('./api/v1/models/product-category.model');

require('dotenv').config();

async function checkDB() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    
    const banners = await Banner.find().lean();
    console.log(`Banners: ${banners.length}`);
    if (banners.length > 0) console.log(banners.map(b => b.title).join(', '));
    
    const widgets = await Widget.find().lean();
    console.log(`\nWidgets: ${widgets.length}`);
    if (widgets.length > 0) console.log(widgets.map(w => w.title).join(', '));
    
    const categories = await ProductCategory.find({ parent_id: null }).lean();
    console.log(`\nParent Categories: ${categories.length}`);
    if (categories.length > 0) console.log(categories.map(c => c.title).slice(0, 10).join(', '));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDB();
