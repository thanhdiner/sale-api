const buildTree = (categories, parent = '') => {
  return categories
    .filter(item => (item.parent_id || '') === (typeof parent === 'object' ? parent.toString() : parent))
    .map(item => ({
      title: item.title,
      value: item._id,
      children: buildTree(categories, item._id)
    }))
}

module.exports.buildTree = buildTree
