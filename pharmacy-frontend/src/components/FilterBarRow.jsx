import { Stack } from "@mui/material";

/** شريط تصفية بسطر واحد — تمرير أفقي تلقائياً على الشاشات الضيقة */
export default function FilterBarRow({ children, sx, ...props }) {
  return (
    <Stack
      direction="row"
      flexWrap="wrap"
      alignItems="center"
      gap={1}
      sx={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "auto",
        overflowY: "hidden",
        pb: 0.25,
        rowGap: 1,
        WebkitOverflowScrolling: "touch",
        ...sx,
      }}
      {...props}
    >
      {children}
    </Stack>
  );
}
