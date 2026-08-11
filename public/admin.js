const adminBase = document.createElement("script");
adminBase.src = "admin-base.js?v=20260811-skill-library-1";
adminBase.onload = () => {
  const extension = document.createElement("script");
  extension.src = "admin-extension.js?v=20260811-skill-library-1";
  document.head.appendChild(extension);
};
document.head.appendChild(adminBase);
