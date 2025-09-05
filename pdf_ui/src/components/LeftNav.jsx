import React from 'react';
import { Drawer, Box, Typography, Card, CardContent, Divider, Link, IconButton } from '@mui/material';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import SupportIcon from '@mui/icons-material/Support';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const LeftNav = ({ isCollapsed, setIsCollapsed }) => {
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: isCollapsed ? 60 : 360,
        flexShrink: 0,
        transition: 'width 0.3s ease',
        [`& .MuiDrawer-paper`]: {
          width: isCollapsed ? 60 : 360,
          boxSizing: 'border-box',
          backgroundColor: '#f9f9f9',
          transition: 'width 0.3s ease',
          overflowX: 'hidden',
        },
      }}
    >
      <Box sx={{ padding: isCollapsed ? 1 : 3, position: 'relative' }}>
        {/* Toggle Button */}
        <IconButton
          onClick={toggleCollapse}
          sx={{
            position: 'absolute',
            top: 8,
            right: isCollapsed ? 8 : 8,
            zIndex: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 1)',
            },
            width: 32,
            height: 32,
          }}
          size="small"
        >
          {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>

        {/* Header - Hidden when collapsed */}
        {!isCollapsed && (
          <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ marginTop: 4 }}>
            About this Solution
          </Typography>
        )}

        {/* Document Requirements Card - Hidden when collapsed */}
        {!isCollapsed && (
          <Card
            sx={{
              marginBottom: 3,
              borderRadius: 2,
              boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)',
            }}
          >
          <CardContent>
            <Box display="flex" alignItems="center" marginBottom={2}>
              <DocumentScannerIcon fontSize="large" color="primary" />
              <Typography variant="h6" fontWeight="bold" sx={{ marginLeft: 1 }}>
                Document Requirements
              </Typography>
            </Box>
            <Divider sx={{ marginBottom: 2 }} />
            <Typography variant="body2" gutterBottom>
              - Each user is limited to <strong>3 PDF document uploads</strong>.
            </Typography>
            <Typography variant="body2" gutterBottom>
              - Documents cannot exceed <strong>10 pages</strong>.
            </Typography>
            <Typography variant="body2" gutterBottom>
              - Documents must be smaller than <strong>25 MB</strong>.
            </Typography>
            <Typography variant="body2" gutterBottom>
              - Do not upload documents containing <strong>sensitive information</strong>.
            </Typography>
            <Typography variant="body2" gutterBottom>
              - Do not <strong>bulk upload</strong> documents.
            </Typography>
            <Typography variant="body2" gutterBottom>
              - Complete remediation for <strong>one document</strong> before adding a new one.
            </Typography>
            <Typography variant="body2" gutterBottom>
              - This solution only remediates <strong>PDF documents</strong>. Other document types will not be accepted.
            </Typography>
            <Typography variant="body2" gutterBottom>
              - This solution does not remediate for <strong>fillable forms and color selection/contrast for people with color blindness</strong>.
            </Typography>
          </CardContent>
        </Card>
        )}

        {/* Support Resources Card - Hidden when collapsed */}
        {!isCollapsed && (
          <Card
            sx={{
              borderRadius: 2,
              boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)',
            }}
          >
          <CardContent>
            <Box display="flex" alignItems="center" marginBottom={2}>
              <SupportIcon fontSize="large" color="secondary" />
              <Typography variant="h6" fontWeight="bold" sx={{ marginLeft: 1 }}>
                Support Resources
              </Typography>
            </Box>
            <Divider sx={{ marginBottom: 2 }} />
            <Typography variant="body2" gutterBottom>
              This solution is available open source and can be added to your AWS account for usage and testing.
              Review documentation and access the GitHub repo at:
            </Typography>
            <Typography variant="body2" gutterBottom>
              <Link href="https://github.com/ASUCICREPO/PDF_Accessibility" target="_blank" rel="noopener noreferrer">
                GitHub Repo
              </Link>
            </Typography>
            <Typography variant="body2" gutterBottom>
              Have questions or need support? Email us: <strong>ai-cic@amazon.com</strong>
            </Typography>
          </CardContent>
        </Card>
        )}
      </Box>
    </Drawer>
  );
};

export default LeftNav;
