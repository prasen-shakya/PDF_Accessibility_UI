import React, { useState, useEffect, useCallback } from 'react';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import ResultsContainer from './ResultsContainer';
import './ProcessingContainer.css';
import img from "../assets/pdf-icon.svg";
import { PDFBucket, HTMLBucket, region } from '../utilities/constants';

const ProcessingContainer = ({
  originalFileName,
  updatedFilename,
  onFileReady,
  awsCredentials,
  selectedFormat,
  onNewUpload
}) => {
  const [downloadUrl, setDownloadUrl] = useState('');
  const [isFileReady, setIsFileReady] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pollingAttempts, setPollingAttempts] = useState(0);

  const processingSteps = [
    { title: "Analyzing Document Structure", description: "Scanning PDF for accessibility issues" },
    { title: "Adding Accessibility Tags", description: "Implementing WCAG 2.1 compliance" },
    { title: "Adding Metadata", description: "Final accessibility enhancements" },
    { title: "Generating Accessible PDF", description: "Creating your accessible PDF document" }
  ];

  const generatePresignedUrl = useCallback(async (bucket, key, filename) => {
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

    try {
      const url = await getSignedUrl(s3, command, { expiresIn: 30000 }); // 8.33 hours expiration
      return url;
    } catch (error) {
      console.error('Error generating presigned URL:', error);
      throw error;
    }
  }, [awsCredentials]);

  // Function to truncate the filename if it exceeds the threshold
  const truncateFilename = (filename) => {
    const FILENAME_THRESHOLD = 30;
    if (filename.length > FILENAME_THRESHOLD) {
      const extensionIndex = filename.lastIndexOf('.');
      const extension = filename.substring(extensionIndex);
      const truncatedName = filename.substring(0, FILENAME_THRESHOLD - extension.length) + '...';
      return truncatedName + extension;
    }
    return filename;
  };

  // Function to format elapsed time
  const formatElapsedTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let intervalId;
    let timeIntervalId;
    let stepIntervalId;

    const checkFileAvailability = async () => {
      // Maximum polling time: 30 minutes (120 attempts * 15 seconds = 30 minutes)
      const MAX_POLLING_ATTEMPTS = 120;

      try {
        // Increment polling attempts
        setPollingAttempts(prev => {
          const newAttempts = prev + 1;

          // Stop polling after maximum attempts
          if (newAttempts >= MAX_POLLING_ATTEMPTS) {
            console.warn('⚠️ Maximum polling attempts reached. Stopping file check.');
            clearInterval(intervalId);
            clearInterval(timeIntervalId);
            clearInterval(stepIntervalId);
            return newAttempts;
          }

          return newAttempts;
        });

        // Select the correct bucket based on format (same logic as UploadSection)
        const selectedBucket = selectedFormat === 'html' ? HTMLBucket : PDFBucket;

        // Check if Bucket is available
        if (!selectedBucket) {
          console.error('❌ Bucket is not defined! Check environment variables.');
          clearInterval(intervalId);
          clearInterval(timeIntervalId);
          clearInterval(stepIntervalId);
          return;
        }

        // Check if AWS credentials are available
        if (!awsCredentials?.accessKeyId) {
          console.warn('⚠️ AWS credentials not available. Stopping polling.');
          clearInterval(intervalId);
          clearInterval(timeIntervalId);
          clearInterval(stepIntervalId);
          return;
        }

        const s3 = new S3Client({
          region,
          credentials: {
            accessKeyId: awsCredentials.accessKeyId,
            secretAccessKey: awsCredentials.secretAccessKey,
            sessionToken: awsCredentials.sessionToken,
          },
        });

        // Use different paths based on format - ensure underscores for HTML format
        let objectKey = selectedFormat === 'html'
          ? `remediated/final_${updatedFilename.replace('.pdf', '.zip').replace(/\s/g, '_')}`
          : `result/COMPLIANT_${updatedFilename}`;

        console.log(`🔍 Polling attempt ${pollingAttempts + 1}/${MAX_POLLING_ATTEMPTS} for object key:`, objectKey);

        // Check if the processed file exists
        await s3.send(
          new HeadObjectCommand({
            Bucket: selectedBucket,
            Key: objectKey,
          })
        );
        const desiredFilename = selectedFormat === 'html'
          ? `final_${originalFileName.replace('.pdf', '.zip')}`
          : `COMPLIANT_${originalFileName}`;

        const url = await generatePresignedUrl(selectedBucket, objectKey, desiredFilename);

        setDownloadUrl(url);
        setIsFileReady(true);
        setCurrentStep(processingSteps.length - 1); // Set to final step
        onFileReady(url);

        // Clear all intervals on success
        clearInterval(intervalId);
        clearInterval(timeIntervalId);
        clearInterval(stepIntervalId);

        console.log('✅ File processing completed successfully!');
      } catch (error) {
        // Log error for debugging but continue polling (file not ready yet)
        console.log(`⏳ File not ready yet (attempt ${pollingAttempts + 1}). Retrying in 15 seconds...`);

        // If this is the last attempt, show an error
        if (pollingAttempts + 1 >= MAX_POLLING_ATTEMPTS) {
          console.error('❌ File processing timed out after maximum attempts');
        }
      }
    };

    if (updatedFilename && !isFileReady) {
      // Reset polling attempts for new file
      setPollingAttempts(0);

      // Start time tracking
      timeIntervalId = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);

      // Microanimation: cycling through steps with cumulative highlighting
      stepIntervalId = setInterval(() => {
        setCurrentStep(prev => (prev + 1) % processingSteps.length);
      }, 1200);

      // File checking with maximum retry limit
      intervalId = setInterval(checkFileAvailability, 15000);
    }

    return () => {
      clearInterval(intervalId);
      clearInterval(timeIntervalId);
      clearInterval(stepIntervalId);
    };
  }, [updatedFilename, isFileReady, onFileReady, awsCredentials, originalFileName, selectedFormat, generatePresignedUrl, processingSteps.length, pollingAttempts]);


  return (
    <div className="processing-container">
      <div className="processing-content">
        <div className="processing-header">
          <div className="file-clock-icon">
            <img alt="" className="block max-w-none size-full" src={img} />
          </div>
          <h2>{isFileReady ? `File Ready: ${truncateFilename(originalFileName)}` : `Processing: ${truncateFilename(originalFileName)}`}</h2>
        </div>

        <div className="processing-info">
          <div className="time-info">
            <span>⏱️ Time elapsed: {formatElapsedTime(elapsedTime)}</span>
          </div>
          <p className="processing-description">
            {isFileReady
              ? 'Remediation complete! Your file is ready for download.'
              : 'Remediation process typically takes a few minutes to complete depending on the document complexity'
            }
          </p>
        </div>

        {!isFileReady ? (
          <div className="progress-section">
            <div className="steps-list">
              {processingSteps.map((step, index) => (
                <div key={index} className="step-item">
                  <div className={`step-number ${index <= currentStep ? 'active' : ''}`}>
                    {index + 1}
                  </div>
                  <div className="step-content">
                    <div className="step-title">{step.title}</div>
                    <div className="step-description">{step.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ResultsContainer
            fileName={originalFileName}
            processedResult={{ url: downloadUrl }}
            format={selectedFormat}
            fileSize="File processed successfully"
            processingTime="Processing completed"
          />
        )}

        <div className="upload-new-section">
          <button className="upload-new-btn" onClick={() => setShowConfirmDialog(true)}>
            Upload a New PDF
          </button>
        </div>

        {/* Custom Confirmation Dialog */}
        {showConfirmDialog && (
          <div className="confirm-overlay" onClick={() => setShowConfirmDialog(false)}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="confirm-header">
                <h3>Confirm New Upload</h3>
              </div>
              <div className="confirm-body">
                <p>Are you sure you want to upload a new PDF?</p>
                <p className="confirm-warning">This will discard the current PDF and start a new session.</p>
              </div>
              <div className="confirm-actions">
                <button
                  className="confirm-btn cancel-btn"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Cancel
                </button>
                <button
                  className="confirm-btn confirm-btn-primary"
                  onClick={() => {
                    setShowConfirmDialog(false);
                    onNewUpload();
                  }}
                >
                  Yes, Upload New PDF
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default ProcessingContainer;
