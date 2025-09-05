import React from 'react';
import { Box, Grid, Typography, Paper } from '@mui/material';
import { styled } from '@mui/material/styles';

const FormatOption = styled(Paper)(({ theme, selected }) => ({
  padding: theme.spacing(3),
  textAlign: 'center',
  cursor: 'pointer',
  border: selected ? `2px solid ${theme.palette.primary.main}` : '1px solid #e0e0e0',
  backgroundColor: selected ? 'rgba(156, 39, 176, 0.04)' : '#fff',
  boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
  },
}));

function FormatSelection({ selectedFormat, onFormatChange }) {
  return (
    <Box sx={{ my: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', mb: 3 }}>
        Choose Output Format
      </Typography>
      <Grid container spacing={3} justifyContent="center">
        <Grid item xs={12} sm={6} md={5}>
          <FormatOption 
            selected={selectedFormat === 'pdf'}
            onClick={() => onFormatChange('pdf')}
            elevation={selectedFormat === 'pdf' ? 4 : 1}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8C1D40',
                  fontSize: '24px',
                }}
              >
                📄
              </Box>
            </Box>
            <Typography variant="h6" component="div">
              PDF to PDF
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Improve accessibility and maintain document structure
            </Typography>
          </FormatOption>
        </Grid>
        <Grid item xs={12} sm={6} md={5}>
          <FormatOption 
            selected={selectedFormat === 'html'}
            onClick={() => onFormatChange('html')}
            elevation={selectedFormat === 'html' ? 4 : 1}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8C1D40',
                  fontSize: '24px',
                }}
              >
                &lt;/&gt;
              </Box>
            </Box>
            <Typography variant="h6" component="div">
              PDF to HTML
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Convert document to accessible HTML version
            </Typography>
          </FormatOption>
        </Grid>
      </Grid>
    </Box>
  );
}

export default FormatSelection;
