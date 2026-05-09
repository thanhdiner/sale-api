const mongoose = require('mongoose')

const websiteConfigSchema = new mongoose.Schema(
  {
    siteName: {
      type: String,
      required: true
    },
    type: String,
    description: String,
    logoUrl: String,
    faviconUrl: String,
    contactInfo: {
      phone: String,
      email: String,
      address: String,
      website: String,
      supportHours: String,
      workingTime: String,
      businessHours: String,
      locations: [
        {
          name: String,
          address: String,
          addressLine1: String,
          provinceName: String,
          districtName: String,
          wardName: String,
          phone: String,
          email: String,
          workingHours: String,
          mapUrl: String,
          googleMapUrl: String,
          latitude: Number,
          longitude: Number,
          isPrimary: Boolean,
          note: String
        }
      ],
      socialMedia: {
        facebook: String,
        twitter: String,
        instagram: String,
        linkedin: String
      }
    },

    seoSettings: {
      metaTitle: { type: String, trim: true, maxlength: 60 },
      metaDescription: { type: String, trim: true, maxlength: 160 },
      keywords: String,
      googleAnalytics: String
    },

    dailySuggestionBanner: {
      leftText: String,
      rightText: String,
      imageUrl: String,
      title: String,
      subtitle: String,
      link: String
    },

    shoppingGuide: mongoose.Schema.Types.Mixed,
    specialPackage: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
)

const WebsiteConfig = mongoose.model('WebsiteConfig', websiteConfigSchema, 'websiteConfigs')

module.exports = WebsiteConfig









