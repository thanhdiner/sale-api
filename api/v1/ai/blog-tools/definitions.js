const getBlogToolDefinitions = () => [
  {
    type: 'function',
    function: {
      name: 'getTrendingProducts',
      description: 'Get trending products for generating blog topics.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 10 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getRecentBlogPosts',
      description: 'Get recent blog posts to avoid duplicate blog topics.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 20 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'checkDuplicateBlogTopic',
      description: 'Check whether a blog topic is duplicated or too similar to existing posts.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' }
        },
        required: ['topic']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggestRelatedProducts',
      description: 'Suggest products related to a blog topic.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          limit: { type: 'number', default: 6 }
        },
        required: ['topic']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'createBlogDraft',
      description: 'Create an AI-generated blog draft in database. This tool must not publish the post.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          excerpt: { type: 'string' },
          content: { type: 'string' },
          seoTitle: { type: 'string' },
          seoDescription: { type: 'string' },
          seoKeywords: {
            type: 'array',
            items: { type: 'string' }
          },
          categorySlug: { type: 'string' },
          category: { type: 'string' },
          tags: {
            type: 'array',
            items: { type: 'string' }
          },
          relatedProductIds: {
            type: 'array',
            items: { type: 'string' }
          },
          translations: {
            type: 'object',
            properties: {
              en: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  excerpt: { type: 'string' },
                  content: { type: 'string' },
                  seoTitle: { type: 'string' },
                  seoDescription: { type: 'string' }
                }
              }
            }
          },
          ai: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              prompt: { type: 'string' },
              qualityScore: { type: 'number' },
              duplicateRisk: {
                type: 'string',
                enum: ['low', 'medium', 'high']
              }
            }
          }
        },
        required: ['title', 'excerpt', 'content']
      }
    }
  }
]

module.exports = {
  getBlogToolDefinitions
}
