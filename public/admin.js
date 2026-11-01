const adminBase = document.createElement("script");
adminBase.src = "admin-base.js?v=20261101-tag-delete-9";
adminBase.onload = () => {
  const extension = document.createElement("script");
  extension.src = "admin-extension.js?v=20261101-category-tags-2";
  document.head.appendChild(extension);
};
document.head.appendChild(adminBase);
