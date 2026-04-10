import React from "react";
import {
  Box,
  Container,
  Grid,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Divider,
  AppBar,
  Toolbar,
  IconButton,
  Drawer,
  CssBaseline,
  alpha,
  keyframes,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { Link, Outlet, NavLink, useLocation } from "react-router-dom";
import {
  Home as HomeIcon,
  School as SchoolIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  LibraryBooks as LibraryBooksIcon,
  Store as StoreIcon,
  Assessment as AssessmentIcon,
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Star,
  Diamond,
  AutoAwesome,
  Verified,
  DarkMode as DarkModeIcon,
} from "@mui/icons-material";
import Cookies from "universal-cookie";

// =========== Animations ===========
const float = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(180deg); }
`;

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
`;

// =========== Styled Components ===========
const HomeSection = styled(Box)(({ theme }) => ({
  background:
    "linear-gradient(135deg, #042c40ff 0%, #0A0A0A 20%, #000000 100%)",
  position: "relative",
  minHeight: "100vh",
  overflow: "hidden",
  direction: "rtl",
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `
      radial-gradient(circle at 20% 20%, ${alpha(
        "#4CC9F0",
        0.03,
      )} 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, ${alpha(
        "#ffffff",
        0.02,
      )} 0%, transparent 50%),
      radial-gradient(circle at 40% 60%, ${alpha(
        "#ffffff",
        0.015,
      )} 0%, transparent 50%),
      radial-gradient(circle at 60% 40%, ${alpha(
        "#ffffff",
        0.01,
      )} 0%, transparent 50%)
    `,
    zIndex: 0,
  },
}));

const FloatingIcon = styled(Box)(
  ({ theme, size, top, left, right, bottom, color, delay }) => ({
    position: "absolute",
    width: size,
    height: size,
    top: top,
    left: left,
    right: right,
    bottom: bottom,
    color: alpha(color || "#fff", 0.1),
    animation: `${float} ${6 + delay}s ease-in-out infinite ${delay}s`,
    zIndex: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size,
  }),
);

const CustomAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: alpha("#fff", 0.05),
  backdropFilter: "blur(20px)",
  borderBottom: `1px solid ${alpha("#fff", 0.1)}`,
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
}));

const CustomCard = styled(Card)(({ theme }) => ({
  backgroundColor: alpha("#fff", 0.05),
  backdropFilter: "blur(20px)",
  borderRadius: "20px",
  border: `1px solid ${alpha("#fff", 0.1)}`,
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  transition: "all 0.3s ease",
  "&:hover": {
    backgroundColor: alpha("#fff", 0.08),
    borderColor: alpha("#fff", 0.3),
    boxShadow: `
      0 15px 40px rgba(0, 0, 0, 0.4),
      0 0 0 1px ${alpha("#fff", 0.2)},
      0 0 20px ${alpha("#fff", 0.1)}
    `,
    transform: "translateY(-5px)",
  },
}));

const particles = [
  { size: "35px", top: "15%", left: "5%", icon: <Star />, delay: 0 },
  { size: "45px", top: "25%", right: "8%", icon: <Diamond />, delay: 1 },
  { size: "40px", bottom: "20%", left: "12%", icon: <AutoAwesome />, delay: 2 },
  { size: "50px", bottom: "30%", right: "15%", icon: <Verified />, delay: 3 },
];
const cookie = new Cookies();
const user = cookie.get("user");

const HomePage = () => {
  const location = useLocation();

  // ط¥ظ†ط´ط§ط، menuItems ط¯ظٹظ†ط§ظ…ظٹظƒظٹط§ظ‹
  const getMenuItems = () => {
    const items = [];

    const user = (() => {
      try {
        return JSON.parse(localStorage.getItem("user"));
      } catch {
        return null;
      }
    })();

    if (!user || !user.role) {
      return items;
    }

    if (user.role === "cashier") {
      items.push({
        text: "ظƒط§ط´ظٹط± Azure",
        icon: <DarkModeIcon />,
        link: "/KasherAzure",
      });
      return items;
    }

    // ظ…ط³ط¤ظˆظ„
    items.push(
      {
        text: "ط¥ط¯ط§ط±ط© ط§ظ„ظ…ط¹ظ„ظˆظ…ط§طھ",
        icon: <SchoolIcon />,
        link: "/TreasuryDeposit",
      },
      {
        text: "ظƒط§ط´ظٹط± Azure",
        icon: <DarkModeIcon />,
        link: "/KasherAzure",
      },
      {
        text: "ط§ظ„ط¹ظ…ط§ظ„",
        icon: <SchoolIcon />,
        link: "/customers",
      },
      {
        text: "ط§ظ„ظ…ط´طھط±ظٹط§طھ",
        icon: <SchoolIcon />,
        link: "/Purchases",
      },
      {
        text: "ط¥ط¯ط§ط±ط© ط§ظ„ظ…ط¨ظٹط¹ط§طھ",
        icon: <SchoolIcon />,
        link: "/SalesManagement",
      },
    );

    return items;
  };

  const menuItems = getMenuItems();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  // ظ…ط­طھظˆظ‰ ط§ظ„ظ‚ط³ظ… ط§ظ„ط¬ط§ظ†ط¨ظٹ
  const drawerContent = (
    <Box
      sx={{
        width: 280,
        backgroundColor: alpha("#fff", 0.05),
        backdropFilter: "blur(20px)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderLeft: `1px solid ${alpha("#fff", 0.1)}`,
      }}
    >
      <Box
        sx={{
          p: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <DashboardIcon sx={{ mr: 1, color: "#4CC9F0" }} />
        <Typography
          variant="h6"
          sx={{
            color: "#fff",
            fontWeight: 800,
            background: "linear-gradient(45deg, #fff 30%, #aaa 90%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          ظ„ظˆط­ط© ط§ظ„طھط­ظƒظ…
        </Typography>
      </Box>
      <Divider sx={{ borderColor: alpha("#fff", 0.1) }} />

      <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2 }}>
        <CustomCard>
          <CardContent>
            <Typography
              variant="h6"
              gutterBottom
              sx={{
                color: "#fff",
                fontWeight: 800,
                textAlign: "center",
                mb: 3,
                position: "relative",
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: "-8px",
                  right: "50%",
                  transform: "translateX(50%)",
                  width: "80px",
                  height: "3px",
                  background:
                    "linear-gradient(90deg, transparent, #4CC9F0, transparent)",
                },
              }}
            >
              ط§ظ„ظ‚ط§ط¦ظ…ط© ط§ظ„ط±ط¦ظٹط³ظٹط©
            </Typography>

            <List sx={{ p: 0 }}>
              {menuItems.map((item, index) => {
                const isActive =
                  location.pathname === item.link ||
                  (item.link !== "/" &&
                    location.pathname.startsWith(item.link));
                return (
                  <React.Fragment key={index}>
                    <ListItem
                      component={NavLink}
                      to={item.link}
                      end={item.link === "/"}
                      sx={{
                        borderRadius: "12px",
                        mb: 1,
                        textAlign: "right",
                        justifyContent: "flex-end",
                        backgroundColor: isActive
                          ? alpha("#4CC9F0", 0.25)
                          : alpha("#fff", 0.05),
                        border: `1px solid ${isActive ? "#4CC9F0" : alpha("#fff", 0.1)}`,
                        transition: "all 0.3s ease",
                        textDecoration: "none",
                        "&.active": {
                          backgroundColor: alpha("#4CC9F0", 0.3),
                          borderColor: "#4CC9F0",
                          "& .MuiTypography-root": { color: "#4CC9F0" },
                          "& .menu-icon": { color: "#4CC9F0" },
                        },
                        "&:hover": {
                          backgroundColor: isActive
                            ? alpha("#4CC9F0", 0.2)
                            : alpha("#fff", 0.1),
                          borderColor: isActive
                            ? "#4CC9F0"
                            : alpha("#fff", 0.3),
                          "& .menu-icon": {
                            transform: "scale(1.1)",
                            color: "#4CC9F0",
                          },
                        },
                      }}
                    >
                      <ListItemText
                        primary={item.text}
                        sx={{
                          textAlign: "right",
                          "& .MuiTypography-root": {
                            color: isActive ? "#4CC9F0" : "#fff",
                            fontWeight: 600,
                            fontSize: "0.95rem",
                          },
                        }}
                      />
                      <ListItemIcon
                        sx={{
                          minWidth: "auto",
                          ml: 1,
                          color: isActive ? "#4CC9F0" : alpha("#fff", 0.7),
                          transition: "all 0.3s ease",
                        }}
                        className="menu-icon"
                      >
                        {item.icon}
                      </ListItemIcon>
                    </ListItem>

                    {index < menuItems.length - 1 && (
                      <Divider
                        sx={{
                          my: 0.5,
                          borderColor: alpha("#fff", 0.05),
                          opacity: 0.5,
                        }}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </List>
          </CardContent>
        </CustomCard>
      </Box>
    </Box>
  );

  return (
    <HomeSection>
      {/* ط§ظ„ط£ظٹظ‚ظˆظ†ط§طھ ط§ظ„ط¹ط§ط¦ظ…ط© */}
      {particles.map((particle, index) => (
        <FloatingIcon
          key={index}
          size={particle.size}
          top={particle.top}
          left={particle.left}
          right={particle.right}
          bottom={particle.bottom}
          delay={particle.delay}
        >
          {particle.icon}
        </FloatingIcon>
      ))}

      <Box sx={{ display: "flex", minHeight: "100vh", direction: "rtl" }}>
        <CssBaseline />

        {/* ط´ط±ظٹط· ط§ظ„طھط·ط¨ظٹظ‚ ط§ظ„ط¹ظ„ظˆظٹ */}
        <CustomAppBar
          position="fixed"
          sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{
                mr: 2,
                display: { md: "none" },
                color: "#fff",
                backgroundColor: alpha("#fff", 0.1),
                "&:hover": {
                  backgroundColor: alpha("#fff", 0.2),
                },
              }}
            >
              <MenuIcon />
            </IconButton>

            <Typography
              variant="h6"
              noWrap
              sx={{
                color: "#fff",
                fontWeight: 800,
                fontSize: { xs: "1.1rem", md: "1.3rem" },
                background: "linear-gradient(45deg, #fff 30%, #4CC9F0 90%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              ظ…ط·ط¹ظ… ط¨ظ„ط§ظ„ ظ„ظ„ظ…ط§ظƒظˆظ„ط§طھ
            </Typography>
          </Toolbar>
        </CustomAppBar>

        {/* ط§ظ„ظ…ط­طھظˆظ‰ ط§ظ„ط±ط¦ظٹط³ظٹ */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            mt: 8,
            width: { md: `calc(100% - 280px)` },
            p: 3,
            position: "relative",
            zIndex: 2,
          }}
        >
          <Outlet />
        </Box>

        {/* ط§ظ„ظ‚ط³ظ… ط§ظ„ط¬ط§ظ†ط¨ظٹ - ظ„ظ„ط´ط§ط´ط§طھ ط§ظ„ظƒط¨ظٹط±ط© */}
        <Box
          component="nav"
          sx={{
            width: { md: 280 },
            flexShrink: { md: 0 },
            display: { xs: "none", md: "block" },
            order: -1,
          }}
        >
          <Drawer
            variant="permanent"
            sx={{
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: 280,
                border: "none",
                backgroundColor: "transparent",
                backdropFilter: "blur(20px)",
                right: 0,
                left: "auto",
                boxShadow: "-3px 0 20px rgba(0,0,0,0.5)",
              },
            }}
            open
            anchor="right"
          >
            {drawerContent}
          </Drawer>
        </Box>

        {/* ط§ظ„ظ‚ط³ظ… ط§ظ„ط¬ط§ظ†ط¨ظٹ ظ„ظ„ط´ط§ط´ط§طھ ط§ظ„طµط؛ظٹط±ط© */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: 280,
              right: 0,
              left: "auto",
              backgroundColor: alpha("#000", 0.95),
              backdropFilter: "blur(20px)",
            },
          }}
          anchor="left"
        >
          {drawerContent}
        </Drawer>
      </Box>
    </HomeSection>
  );
};

export default HomePage;
