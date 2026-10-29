const adminBase = document.createElement("script");
adminBase.src = "admin-base.js?v=20261029-category-cover-fallback-5";
adminBase.onload = () => {
  const extension = document.createElement("script");
  extension.src = "admin-extension.js?v=20261029-category-delete-1";
  document.head.appendChild(extension);
};
document.head.appendChild(adminBase);
