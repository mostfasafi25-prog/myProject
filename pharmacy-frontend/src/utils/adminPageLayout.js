/** تنسيق جذر صفحات الإدارة — يمنع تهريب العرض على الشاشات الضيقة */
export const adminPageContainerSx = {
  p: { xs: 1, sm: 1.5, md: 2 },
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

/** صف العنوان + زر الإجراء — عمودي على الموبايل */
export const adminPageTitleRowSx = {
  mb: 2,
  flexDirection: { xs: "column", sm: "row" },
  alignItems: { xs: "stretch", sm: "center" },
  justifyContent: "space-between",
  gap: { xs: 1.25, sm: 0 },
};

/** وصف تحت العنوان — يُخفى على الشاشات الضيقة لتوفير المساحة */
export const adminPageSubtitleSx = {
  display: { xs: "none", sm: "block" },
};
