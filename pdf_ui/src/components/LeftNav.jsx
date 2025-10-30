import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DocumentScannerIcon from "@mui/icons-material/DocumentScanner";
import SupportIcon from "@mui/icons-material/Support";
import {
  Box,
  Card,
  CardContent,
  Divider,
  Drawer,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";

const LeftNav = ({
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const toggleCollapse = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const handleDrawerClose = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  return (
    <Drawer
      variant={isMobile ? "temporary" : "permanent"}
      open={isMobile ? mobileOpen : true}
      onClose={handleDrawerClose}
      sx={{
        width: isMobile ? "100%" : isCollapsed ? 60 : 360,
        flexShrink: 0,
        transition: "width 0.3s ease",
        [`& .MuiDrawer-paper`]: {
          width: isMobile ? "100%" : isCollapsed ? 60 : 360,
          maxWidth: isMobile ? "320px" : "none",
          boxSizing: "border-box",
          backgroundColor: "#f9f9f9",
          transition: "width 0.3s ease",
          overflowX: "hidden",
        },
      }}
    >
      <Box sx={{ padding: isCollapsed ? 1 : 3, position: "relative" }}>
        {/* Toggle Button */}
        <IconButton
          onClick={toggleCollapse}
          sx={{
            position: "absolute",
            top: 8,
            right: isMobile ? 8 : isCollapsed ? 8 : 8,
            zIndex: 1,
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            "&:hover": {
              backgroundColor: "rgba(255, 255, 255, 1)",
            },
            width: isMobile ? 40 : 32,
            height: isMobile ? 40 : 32,
            minHeight: 44,
            minWidth: 44,
          }}
          size="small"
          aria-label={
            isMobile
              ? "Close navigation menu"
              : isCollapsed
              ? "Expand navigation"
              : "Collapse navigation"
          }
        >
          {isMobile ? (
            <ChevronLeftIcon />
          ) : isCollapsed ? (
            <ChevronRightIcon />
          ) : (
            <ChevronLeftIcon />
          )}
        </IconButton>

        {/* Document Requirements Card - Hidden when collapsed on desktop, always shown on mobile */}
        {(!isCollapsed || isMobile) && (
          <Card
            sx={{
              marginTop: 6,
              marginBottom: 3,
              borderRadius: 2,
              boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" marginBottom={2}>
                <DocumentScannerIcon fontSize="large" color="primary" />
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  sx={{ marginLeft: 1 }}
                >
                  Document Requirements
                </Typography>
              </Box>
              <Divider sx={{ marginBottom: 2 }} />
              <Typography variant="body2" gutterBottom>
                - Large documents with many images or complex formatting may
                <strong> take longer or fail to remediate.</strong>
              </Typography>
              <Typography variant="body2" gutterBottom>
                - If a document takes longer than a few minutes to remediate,
                try <strong>splitting the PDF into smaller sections</strong>,
                and uploading those sections.
              </Typography>
              <Typography variant="body2" gutterBottom>
                - Complete remediation for <strong>one document</strong> before
                adding a new one.
              </Typography>
              <Typography variant="body2" gutterBottom>
                - This solution only remediates <strong>PDF documents</strong>.
                Other document types will not be accepted.
              </Typography>
              <Typography variant="body2" gutterBottom>
                - This solution does not remediate for{" "}
                <strong>
                  fillable forms and color selection/contrast for people with
                  color blindness
                </strong>
                .
              </Typography>
              <Typography variant="body2" gutterBottom>
                - Files are temporarily stored and will be{" "}
                <strong>automatically deleted after 24 hours. </strong>
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Support Resources Card - Hidden when collapsed on desktop, always shown on mobile */}
        {(!isCollapsed || isMobile) && (
          <Card
            sx={{
              borderRadius: 2,
              boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
            }}
          >
            <CardContent>
              <Box display="flex" alignItems="center" marginBottom={2}>
                <SupportIcon fontSize="large" color="primary" />
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  sx={{ marginLeft: 1 }}
                >
                  Support Resources
                </Typography>
              </Box>
              <Divider sx={{ marginBottom: 2 }} />
              <Typography variant="body2" gutterBottom>
                Have questions or need support? Email:{" "}
                <strong>shakyap@sonoma.edu</strong>
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>
    </Drawer>
  );
};

export default LeftNav;
