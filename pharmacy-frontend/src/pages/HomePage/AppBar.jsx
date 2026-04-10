import {
  AppBar,
  IconButton,
  Toolbar,
  Typography,
  Box,
  Avatar,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
} from "@mui/material";
import React, { useState } from "react";
import {
  Menu as MenuIcon,
  Notifications,
  AccountCircle,
  Settings,
  ExitToApp,
  School,
  Brightness4,
  Brightness7,
} from "@mui/icons-material";

export default function AppBarPage({ handleDrawerToggle }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [notificationAnchor, setNotificationAnchor] = useState(null);

  const handleProfileClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationClick = (event) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setNotificationAnchor(null);
  };

  const handleDarkModeToggle = () => {
    setDarkMode(!darkMode);
  };

  const notifications = [
    "ظ„ط¯ظٹظƒ 5 ط·ظ„ط¨ط§طھ ط¬ط¯ظٹط¯ط©",
    "ط§ط¬طھظ…ط§ط¹ ط§ظ„ظ…ط¯ط±ط³ظٹظ† ط؛ط¯ط§ظ‹",
    "طھظ‚ط§ط±ظٹط± ط§ظ„ط·ظ„ط§ط¨ ط¬ط§ظ‡ط²ط©",
    "طھط­ط¯ظٹط« ط§ظ„ظ†ط¸ط§ظ… ظ…طھط§ط­",
  ];

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        background: "linear-gradient(45deg, #1976d2 30%, #2196f3 90%)",
        boxShadow: "0 3px 20px rgba(0,0,0,0.2)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        {/* ط§ظ„ط¬ط§ظ†ط¨ ط§ظ„ط£ظٹظ…ظ†: ط²ط± ط§ظ„ظ‚ط§ط¦ظ…ط© ظˆط§ظ„ط´ط¹ط§ط± */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{
              mr: 2,
              display: { md: "none" },
              background: "rgba(255,255,255,0.1)",
              "&:hover": {
                background: "rgba(255,255,255,0.2)",
              },
            }}
          >
            <MenuIcon />
          </IconButton>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              background: "rgba(255,255,255,0.1)",
              borderRadius: 2,
              px: 2,
              py: 0.5,
            }}
          >
            <School sx={{ mr: 1, fontSize: 28 }} />
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontWeight: "bold",
                textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
              }}
            >
              ظ…ط·ط¹ظ… ط¨ظ„ط§ظ„ ظ„ظ„ظ…ط§ظƒظˆظ„ط§طھ
            </Typography>
          </Box>
        </Box>

        {/* ط§ظ„ط¬ط§ظ†ط¨ ط§ظ„ط£ظٹط³ط±: ط§ظ„ط£ظٹظ‚ظˆظ†ط§طھ ظˆط§ظ„ط¥ط´ط¹ط§ط±ط§طھ */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* ط²ط± ط§ظ„ظˆط¶ط¹ ط§ظ„ط¯ط§ظƒظ† */}
          <IconButton
            color="inherit"
            onClick={handleDarkModeToggle}
            sx={{
              background: "rgba(255,255,255,0.1)",
              "&:hover": { background: "rgba(255,255,255,0.2)" },
            }}
          >
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>

          {/* ط²ط± ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ */}
          <IconButton
            color="inherit"
            onClick={handleNotificationClick}
            sx={{
              background: "rgba(255,255,255,0.1)",
              "&:hover": { background: "rgba(255,255,255,0.2)" },
            }}
          >
            <Badge badgeContent={4} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          {/* ظ‚ط§ط¦ظ…ط© ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ */}
          <Menu
            anchorEl={notificationAnchor}
            open={Boolean(notificationAnchor)}
            onClose={handleClose}
            PaperProps={{
              sx: {
                mt: 1.5,
                minWidth: 300,
                borderRadius: 2,
                boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
              },
            }}
          >
            <Box sx={{ p: 2, borderBottom: "1px solid #eee" }}>
              <Typography variant="subtitle1" fontWeight="bold">
                ط§ظ„ط¥ط´ط¹ط§ط±ط§طھ (4)
              </Typography>
            </Box>
            {notifications.map((notification, index) => (
              <MenuItem key={index} onClick={handleClose} sx={{ py: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <Notifications sx={{ mr: 2, color: "primary.main" }} />
                  <Typography variant="body2">{notification}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Menu>

          {/* ط§ظ„ظ…ظ„ظپ ط§ظ„ط´ط®طµظٹ */}
          <IconButton
            onClick={handleProfileClick}
            sx={{
              ml: 1,
              background: "rgba(255,255,255,0.1)",
              "&:hover": { background: "rgba(255,255,255,0.2)" },
            }}
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                background: "linear-gradient(45deg, #ff6b6b, #ffa726)",
                fontWeight: "bold",
              }}
            >
              ط£
            </Avatar>
          </IconButton>

          {/* ظ‚ط§ط¦ظ…ط© ط§ظ„ظ…ظ„ظپ ط§ظ„ط´ط®طµظٹ */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            PaperProps={{
              sx: {
                mt: 1.5,
                minWidth: 200,
                borderRadius: 2,
                boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
              },
            }}
          >
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  margin: "0 auto 10px",
                  background: "linear-gradient(45deg, #ff6b6b, #ffa726)",
                  fontSize: "1.5rem",
                }}
              >
                ط£
              </Avatar>
              <Typography variant="subtitle1" fontWeight="bold">
                ط£ط­ظ…ط¯ ظ…ط­ظ…ط¯
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ظ…ط¯ظٹط± ط§ظ„ظ†ط¸ط§ظ…
              </Typography>
            </Box>

            <Divider />

            <MenuItem onClick={handleClose}>
              <ListItemIcon>
                <AccountCircle fontSize="small" />
              </ListItemIcon>
              <Typography variant="body2">ط§ظ„ظ…ظ„ظپ ط§ظ„ط´ط®طµظٹ</Typography>
            </MenuItem>

            <MenuItem onClick={handleClose}>
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              <Typography variant="body2">ط§ظ„ط¥ط¹ط¯ط§ط¯ط§طھ</Typography>
            </MenuItem>

            <Divider />

            <MenuItem onClick={handleClose} sx={{ color: "error.main" }}>
              <ListItemIcon>
                <ExitToApp fontSize="small" color="error" />
              </ListItemIcon>
              <Typography variant="body2">طھط³ط¬ظٹظ„ ط§ظ„ط®ط±ظˆط¬</Typography>
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>

      {/* ط´ط±ظٹط· ط§ظ„طھظ‚ط¯ظ… */}
      <Box
        sx={{
          width: "100%",
          height: 3,
          background:
            "linear-gradient(90deg, #ff6b6b, #ffa726, #4caf50, #2196f3)",
          backgroundSize: "300% 100%",
          animation: "progress 3s ease-in-out infinite",
          "@keyframes progress": {
            "0%": { backgroundPosition: "0% 50%" },
            "50%": { backgroundPosition: "100% 50%" },
            "100%": { backgroundPosition: "0% 50%" },
          },
        }}
      />
    </AppBar>
  );
}
