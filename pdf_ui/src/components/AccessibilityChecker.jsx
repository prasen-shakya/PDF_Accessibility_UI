// src/components/AccessibilityChecker.js
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PDFBucket, region } from "../utilities/constants";

function AccessibilityChecker({
  originalFileName,
  updatedFilename,
  awsCredentials,
  open,
  onClose,
}) {
  // Reports in JSON form
  const [beforeReport, setBeforeReport] = useState(null);
  const [afterReport, setAfterReport] = useState(null);

  // Signed URLs for downloading the JSON reports
  const [beforeReportUrl, setBeforeReportUrl] = useState(null);
  const [afterReportUrl, setAfterReportUrl] = useState(null);

  // Loading states for generating pre-signed URLs
  const [isBeforeUrlLoading, setIsBeforeUrlLoading] = useState(false);
  const [isAfterUrlLoading, setIsAfterUrlLoading] = useState(false);

  const UpdatedFileKeyWithoutExtension = updatedFilename
    ? updatedFilename.replace(/\.pdf$/i, "")
    : "";
  const beforeReportKey = `temp/${UpdatedFileKeyWithoutExtension}/accessability-report/${UpdatedFileKeyWithoutExtension}_accessibility_report_before_remidiation.json`;
  const afterReportKey = `temp/${UpdatedFileKeyWithoutExtension}/accessability-report/COMPLIANT_${UpdatedFileKeyWithoutExtension}_accessibility_report_after_remidiation.json`;

  const OriginalFileKeyWithoutExtension = originalFileName
    ? originalFileName.replace(/\.pdf$/i, "")
    : "";
  const desiredFilenameBefore = `COMPLIANT_${OriginalFileKeyWithoutExtension}_before_remediation_accessibility_report.json`;
  const desiredFilenameAfter = `COMPLIANT_${OriginalFileKeyWithoutExtension}_after_remediation_accessibility_report.json`;

  const s3 = useMemo(() => {
    if (!awsCredentials?.accessKeyId) {
      console.warn("AWS credentials not available yet");
      return null;
    }
    return new S3Client({
      region,
      credentials: {
        accessKeyId: awsCredentials.accessKeyId,
        secretAccessKey: awsCredentials.secretAccessKey,
        sessionToken: awsCredentials.sessionToken,
      },
    });
  }, [awsCredentials]);

  /**
   * Utility to fetch the JSON file from S3 (assuming it exists).
   */
  const fetchJsonFromS3 = useCallback(
    async (key) => {
      if (!s3) {
        throw new Error(
          "S3 client not initialized - check environment variables and AWS credentials"
        );
      }
      await s3.send(new HeadObjectCommand({ Bucket: PDFBucket, Key: key }));
      const getObjRes = await s3.send(
        new GetObjectCommand({ Bucket: PDFBucket, Key: key })
      );
      const bodyString = await getObjRes.Body.transformToString();
      return JSON.parse(bodyString);
    },
    [s3]
  );

  /**
   * Generate a presigned URL for direct download
   */
  const generatePresignedUrl = useCallback(
    async (key, filename) => {
      if (!s3) {
        throw new Error(
          "S3 client not initialized - check environment variables and AWS credentials"
        );
      }
      const command = new GetObjectCommand({
        Bucket: PDFBucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      });
      return await getSignedUrl(s3, command, { expiresIn: 30000 }); // 8.3 hours
    },
    [s3]
  );

  /**
   * Fetch BEFORE report
   */
  const fetchBeforeReport = useCallback(
    async (retries = 3) => {
      if (!s3) return;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const data = await fetchJsonFromS3(beforeReportKey);
          setBeforeReport(data);
          setIsBeforeUrlLoading(true);
          const presignedUrl = await generatePresignedUrl(
            beforeReportKey,
            desiredFilenameBefore
          );
          setBeforeReportUrl(presignedUrl);
          return;
        } catch (error) {
          console.log(
            `Attempt ${attempt}/${retries} failed for BEFORE report:`,
            error.message
          );
          if (attempt < retries) await new Promise((r) => setTimeout(r, 2000));
        } finally {
          setIsBeforeUrlLoading(false);
        }
      }
    },
    [
      beforeReportKey,
      desiredFilenameBefore,
      fetchJsonFromS3,
      generatePresignedUrl,
      s3,
    ]
  );

  /**
   * Fetch AFTER report
   */
  const fetchAfterReport = useCallback(
    async (retries = 3) => {
      if (!s3) return;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const data = await fetchJsonFromS3(afterReportKey);
          setAfterReport(data);
          setIsAfterUrlLoading(true);
          const presignedUrl = await generatePresignedUrl(
            afterReportKey,
            desiredFilenameAfter
          );
          setAfterReportUrl(presignedUrl);
          return;
        } catch (error) {
          console.log(
            `Attempt ${attempt}/${retries} failed for AFTER report:`,
            error.message
          );
          if (attempt < retries) await new Promise((r) => setTimeout(r, 2000));
        } finally {
          setIsAfterUrlLoading(false);
        }
      }
    },
    [
      afterReportKey,
      desiredFilenameAfter,
      fetchJsonFromS3,
      generatePresignedUrl,
      s3,
    ]
  );

  const handleClose = () => onClose();

  useEffect(() => {
    if (open && updatedFilename && s3) {
      fetchBeforeReport();
      fetchAfterReport();
    }
  }, [open, updatedFilename, fetchBeforeReport, fetchAfterReport, s3]);

  /**
   * Summary block renderer (Before / After)
   */
  const renderSummary = (report, label) => {
    if (!report) return null;
    const { Summary } = report;
    if (!Summary) return null;

    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#fafafa",
          border: "1px solid #ddd",
          borderRadius: 2,
          p: 2,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <Typography
          variant="h6"
          sx={{ color: "#1976d2", fontWeight: "bold", mb: 1 }}
        >
          {`${label} Summary`}
        </Typography>
        <Table
          size="small"
          sx={{
            border: "1px solid #ddd",
            borderRadius: 2,
            flexGrow: 1,
          }}
        >
          <TableHead sx={{ backgroundColor: "#f5f5f5" }}>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell>Needs Manual Check</TableCell>
              <TableCell>Passed</TableCell>
              <TableCell>Failed</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>{Summary.Description}</TableCell>
              <TableCell>
                <Chip label={Summary["Needs manual check"]} color="warning" />
              </TableCell>
              <TableCell>
                <Chip label={Summary.Passed} color="success" />
              </TableCell>
              <TableCell>
                <Chip label={Summary.Failed} color="error" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>
    );
  };

  /**
   * Detailed comparison
   */
  const renderDetailedReport = () => {
    if (!beforeReport) return <CircularProgress />;

    const categories = Object.keys(beforeReport["Detailed Report"] || {});
    return categories.map((category) => {
      const beforeItems = beforeReport["Detailed Report"][category] || [];
      const afterItems = afterReport?.["Detailed Report"]?.[category] || [];
      const allRules = new Set([
        ...beforeItems.map((i) => i.Rule),
        ...afterItems.map((i) => i.Rule),
      ]);
      const afterMap = afterItems.reduce((acc, i) => {
        acc[i.Rule] = i;
        return acc;
      }, {});

      return (
        <Accordion
          key={category}
          sx={{ border: "1px solid #ddd", mt: "0.5rem" }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{ backgroundColor: "#e3f2fd" }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
              {category}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Table size="small" sx={{ border: "1px solid #ddd" }}>
              <TableHead>
                <TableRow>
                  <TableCell>Rule</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Status (Before)</TableCell>
                  <TableCell>Status (After)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.from(allRules).map((rule) => {
                  const beforeItem = beforeItems.find((i) => i.Rule === rule);
                  const afterItem = afterMap[rule];
                  return (
                    <TableRow key={rule}>
                      <TableCell>{rule}</TableCell>
                      <TableCell>
                        {afterItem
                          ? afterItem.Description
                          : beforeItem?.Description}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={beforeItem?.Status || "—"}
                          color={
                            beforeItem?.Status === "Passed"
                              ? "success"
                              : beforeItem?.Status === "Failed"
                              ? "error"
                              : "warning"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={afterItem?.Status || "—"}
                          color={
                            afterItem?.Status === "Passed"
                              ? "success"
                              : afterItem?.Status === "Failed"
                              ? "error"
                              : "warning"
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </AccordionDetails>
        </Accordion>
      );
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="lg">
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6" sx={{ flex: 1 }}>
          Accessibility Reports (Results By Adobe Accessibility Checker)
        </Typography>

        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            disabled={!beforeReportUrl || isBeforeUrlLoading}
            onClick={() => window.open(beforeReportUrl, "_blank")}
            startIcon={isBeforeUrlLoading && <CircularProgress size={14} />}
            sx={{ fontSize: "0.75rem", padding: "4px 8px" }}
          >
            Before
          </Button>

          <Button
            variant="outlined"
            color="primary"
            size="small"
            disabled={!afterReportUrl || isAfterUrlLoading}
            onClick={() => window.open(afterReportUrl, "_blank")}
            startIcon={isAfterUrlLoading && <CircularProgress size={14} />}
            sx={{ fontSize: "0.75rem", padding: "4px 8px" }}
          >
            After
          </Button>

          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box>
          <Box
            sx={{
              display: "flex",
              gap: "2rem",
              flexWrap: "wrap",
              alignItems: "stretch",
            }}
          >
            <Box sx={{ flex: 1, display: "flex" }}>
              {renderSummary(beforeReport, "Before")}
            </Box>
            <Box sx={{ flex: 1, display: "flex" }}>
              {renderSummary(afterReport, "After")}
            </Box>
          </Box>

          <Typography
            variant="h5"
            sx={{ mt: "2rem", color: "#1565c0", fontWeight: "bold" }}
          >
            Detailed Report
          </Typography>

          {(!beforeReport || !afterReport) && (
            <Typography variant="body2" color="textSecondary">
              Loading accessibility reports...
            </Typography>
          )}

          <Box sx={{ mt: "1rem" }}>{renderDetailedReport()}</Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 2,
          p: "1rem",
        }}
      >
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AccessibilityChecker;
