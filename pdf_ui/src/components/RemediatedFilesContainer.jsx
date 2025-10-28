import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import Button from "@mui/material/Button";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import AccessibilityChecker from "../components/AccessibilityChecker"; // ✅ import added
import { HTMLBucket, PDFBucket, region } from "../utilities/constants";
import "./RemediatedFilesContainer.css";

// Convert S3 sanitized filename back to readable
const normalizePdfFilename = (sanitized) => {
  if (!sanitized) return sanitized;
  let name = sanitized.replace(/^COMPLIANT_/, "");
  name = name.replace(/^[A-Za-z0-9_]+_\d{8,}_/, ""); // remove user/timestamp prefix
  name = name.replace(/_/g, " ");
  name = name.replace(/%20/g, " ").trim();
  return name;
};

// 📅 Format the S3 "LastModified" date nicely
const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const RemediatedFilesContainer = ({ awsCredentials, refreshFlag }) => {
  const auth = useAuth();
  const [files, setFiles] = useState([]);

  // 👇 Added for AccessibilityChecker dialog
  const [selectedFile, setSelectedFile] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleOpenChecker = (file) => {
    setSelectedFile(file);
    setDialogOpen(true);
  };

  const handleCloseChecker = () => {
    setDialogOpen(false);
    setSelectedFile(null);
  };

  const generatePresignedUrl = useCallback(
    async (bucket, key, filename) => {
      try {
        const s3 = new S3Client({
          region,
          credentials: {
            accessKeyId: awsCredentials?.accessKeyId,
            secretAccessKey: awsCredentials?.secretAccessKey,
            sessionToken: awsCredentials?.sessionToken,
          },
        });

        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentDisposition: `attachment; filename="${filename}"`,
        });

        const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
        return url;
      } catch (error) {
        console.error("Error generating presigned URL:", error);
        return null;
      }
    },
    [awsCredentials]
  );

  useEffect(() => {
    if (!awsCredentials || !auth.user) return;

    const userEmail = auth.user?.profile?.email;
    const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, "_");

    const s3 = new S3Client({
      region,
      credentials: awsCredentials,
    });

    const pdfParams = {
      Bucket: PDFBucket,
      Prefix: `result/COMPLIANT_${sanitizedEmail}`,
    };
    const htmlParams = {
      Bucket: HTMLBucket,
      Prefix: `output/${sanitizedEmail}`,
    };

    const fetchPDF = async () => {
      const response = await s3.send(new ListObjectsV2Command(pdfParams));
      if (!response.Contents) return [];
      return Promise.all(
        response.Contents.map(async (item) => {
          const fileName = item.Key.split("/").pop();
          const readableName = normalizePdfFilename(fileName);
          const url = await generatePresignedUrl(
            PDFBucket,
            item.Key,
            readableName
          );
          return {
            key: item.Key,
            name: readableName,
            date: formatDate(item.LastModified),
            download_link: url,
            originalFileName: fileName
              .replace(/^COMPLIANT_/, "")
              .replace(sanitizedEmail, ""),
            updatedFilename: fileName.replace(/^COMPLIANT_/, ""),
          };
        })
      );
    };

    const fetchHTML = async () => {
      const response = await s3.send(new ListObjectsV2Command(htmlParams));
      if (!response.Contents) return [];
      return Promise.all(
        response.Contents.map(async (item) => {
          const fileName = item.Key.split("/").pop();
          const readableName = normalizePdfFilename(fileName);
          const url = await generatePresignedUrl(
            HTMLBucket,
            item.Key,
            readableName
          );
          return {
            key: item.Key,
            name: readableName,
            date: formatDate(item.LastModified),
            download_link: url,
          };
        })
      );
    };

    const loadAll = async () => {
      try {
        const [pdfFiles, htmlFiles] = await Promise.all([
          fetchPDF(),
          fetchHTML(),
        ]);
        const allFiles = [...pdfFiles, ...htmlFiles].sort(
          (a, b) => new Date(b.date) - new Date(a.date)
        );
        setFiles(allFiles);
      } catch (err) {
        console.error("Error fetching remediated files:", err);
      }
    };

    loadAll();
  }, [awsCredentials, auth.user, generatePresignedUrl, refreshFlag]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ marginTop: "24px" }}
    >
      {/* Outer container */}
      <div className="remediated-container">
        <h2
          style={{
            fontFamily: "Geist, sans-serif",
            fontWeight: 600,
            fontSize: "18px",
            lineHeight: "28px",
            color: "#020617",
            textAlign: "center",
            marginBottom: "16px",
          }}
        >
          Remediated Files
        </h2>

        {files.length === 0 ? (
          <p
            style={{
              fontFamily: "Geist, sans-serif",
              fontWeight: 400,
              fontSize: "14px",
              color: "#475569",
              textAlign: "center",
            }}
          >
            Remediated files will appear here once the remediation process is
            complete.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              width: "100%",
            }}
          >
            {files.map((file, index) => (
              <div key={index} className="remediated-file">
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "Geist, sans-serif",
                      fontWeight: 500,
                      fontSize: "14px",
                      color: "#020617",
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file.name}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "Geist, sans-serif",
                      fontWeight: 400,
                      fontSize: "12px",
                      color: "#64748b",
                    }}
                  >
                    {file.date}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  {file.name.endsWith(".pdf") && (
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{
                        borderColor: "#004c97",
                        color: "#004c97",
                        textTransform: "none",
                        fontWeight: 500,
                        "&:hover": {
                          borderColor: "#004c97",
                          backgroundColor: "#e0f2fe",
                        },
                      }}
                      onClick={() => handleOpenChecker(file)} // 👈 open dialog instead
                    >
                      View Report
                    </Button>
                  )}

                  <Button
                    variant="contained"
                    size="small"
                    sx={{
                      backgroundColor: "#004c97",
                      textTransform: "none",
                      fontWeight: 500,
                      "&:hover": { backgroundColor: "#1868b7" },
                    }}
                    href={file.download_link}
                    download
                  >
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedFile && (
        <AccessibilityChecker
          originalFileName={selectedFile.originalFileName}
          updatedFilename={selectedFile.updatedFilename}
          awsCredentials={awsCredentials}
          open={dialogOpen}
          onClose={handleCloseChecker}
        />
      )}
    </motion.div>
  );
};

export default RemediatedFilesContainer;
