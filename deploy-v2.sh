#!/usr/bin/env bash
set -euo pipefail

# --------------------------------------------------
# 1. Configure S3 buckets for PDF processing
# --------------------------------------------------

TIMESTAMP=$(date +%Y%m%d%H%M%S)
PROJECT_NAME="pdf-ui-${TIMESTAMP}"
echo "Auto-generated project name: $PROJECT_NAME"

# Configure S3 buckets (at least one required)
if [ -z "${PDF_TO_PDF_BUCKET:-}" ]; then
  read -rp "Enter PDF-to-PDF bucket name (leave empty if not using PDF-to-PDF processing): " PDF_TO_PDF_BUCKET
fi

if [ -z "${PDF_TO_HTML_BUCKET:-}" ]; then
  read -rp "Enter PDF-to-HTML bucket name (leave empty if not using PDF-to-HTML processing): " PDF_TO_HTML_BUCKET
fi

# Validate that at least one bucket is provided
if [ -z "${PDF_TO_PDF_BUCKET:-}" ] && [ -z "${PDF_TO_HTML_BUCKET:-}" ]; then
  echo "❌ Error: At least one bucket name is required (PDF_TO_PDF_BUCKET or PDF_TO_HTML_BUCKET)"
  exit 1
fi

# --------------------------------------------------
# 2. Ensure IAM service role exists
# --------------------------------------------------

ROLE_NAME="${PROJECT_NAME}-service-role"
echo "Checking for IAM role: $ROLE_NAME"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "✓ IAM role exists"
  ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)
else
  echo "✱ Creating IAM role: $ROLE_NAME"
  TRUST_DOC='{
    "Version":"2012-10-17",
    "Statement":[{
      "Effect":"Allow",
      "Principal":{"Service":"codebuild.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }]
  }'

  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_DOC" \
    --query 'Role.Arn' --output text)

  echo "Attaching AdministratorAccess policy..."
  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

  echo "✓ IAM role created"
  echo "Waiting for IAM role to propagate for 10 seconds..."
  sleep 10
fi

# --------------------------------------------------
# 3. Create Backend CodeBuild project
# --------------------------------------------------

BACKEND_PROJECT_NAME="${PROJECT_NAME}-backend"
echo "Creating Backend CodeBuild project: $BACKEND_PROJECT_NAME"

# Build environment variables array for backend
ENV_VARS_ARRAY=""

# Add PDF_TO_PDF_BUCKET if provided
if [ -n "${PDF_TO_PDF_BUCKET:-}" ]; then
  ENV_VARS_ARRAY='{
      "name":  "PDF_TO_PDF_BUCKET",
      "value": "'"$PDF_TO_PDF_BUCKET"'",
      "type":  "PLAINTEXT"
    }'
fi

# Add PDF_TO_HTML_BUCKET if provided
if [ -n "${PDF_TO_HTML_BUCKET:-}" ]; then
  if [ -n "$ENV_VARS_ARRAY" ]; then
    ENV_VARS_ARRAY="$ENV_VARS_ARRAY,"
  fi
  ENV_VARS_ARRAY="$ENV_VARS_ARRAY"'{
      "name":  "PDF_TO_HTML_BUCKET",
      "value": "'"$PDF_TO_HTML_BUCKET"'",
      "type":  "PLAINTEXT"
    }'
fi

# Add PROJECT_TIMESTAMP for SSM parameter naming
if [ -n "$ENV_VARS_ARRAY" ]; then
  ENV_VARS_ARRAY="$ENV_VARS_ARRAY,"
fi
ENV_VARS_ARRAY="$ENV_VARS_ARRAY"'{
    "name":  "PROJECT_TIMESTAMP",
    "value": "'"$TIMESTAMP"'",
    "type":  "PLAINTEXT"
  }'

BACKEND_ENVIRONMENT='{
  "type": "LINUX_CONTAINER",
  "image": "aws/codebuild/amazonlinux-x86_64-standard:5.0",
  "computeType": "BUILD_GENERAL1_SMALL",
  "environmentVariables": ['"$ENV_VARS_ARRAY"']
}'

# Backend buildspec
BACKEND_SOURCE='{
  "type":"GITHUB",
  "location":"https://github.com/ASUCICREPO/PDF_accessability_UI.git",
  "buildspec":"buildspec-backend.yml"
}'

ARTIFACTS='{"type":"NO_ARTIFACTS"}'
SOURCE_VERSION="updatedUI"

echo "Creating Backend CodeBuild project '$BACKEND_PROJECT_NAME'..."
aws codebuild create-project \
  --name "$BACKEND_PROJECT_NAME" \
  --source "$BACKEND_SOURCE" \
  --source-version "$SOURCE_VERSION" \
  --artifacts "$ARTIFACTS" \
  --environment "$BACKEND_ENVIRONMENT" \
  --service-role "$ROLE_ARN" \
  --output json

if [ $? -ne 0 ]; then
  echo "✗ Failed to create backend CodeBuild project"
  exit 1
fi

# --------------------------------------------------
# 4. Start Backend Build and Wait for Completion
# --------------------------------------------------

echo "Starting backend build for project '$BACKEND_PROJECT_NAME'..."
BACKEND_BUILD_ID=$(aws codebuild start-build \
  --project-name "$BACKEND_PROJECT_NAME" \
  --query 'build.id' \
  --output text)

if [ $? -ne 0 ]; then
  echo "✗ Failed to start the backend build"
  exit 1
fi

echo "✓ Backend build started successfully. Build ID: $BACKEND_BUILD_ID"

# Wait for backend build to complete
echo "Waiting for backend build to complete..."
BUILD_STATUS="IN_PROGRESS"

while [ "$BUILD_STATUS" = "IN_PROGRESS" ]; do
  sleep 15
  BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$BACKEND_BUILD_ID" --query 'builds[0].buildStatus' --output text)
  echo "Backend build status: $BUILD_STATUS"
done

if [ "$BUILD_STATUS" != "SUCCEEDED" ]; then
  echo "❌ Backend build failed with status: $BUILD_STATUS"
  echo "Check CodeBuild logs for details: https://console.aws.amazon.com/codesuite/codebuild/projects/$BACKEND_PROJECT_NAME/build/$BACKEND_BUILD_ID/"
  exit 1
fi

echo "✅ Backend build completed successfully!"

# --------------------------------------------------
# 5. Create Frontend CodeBuild Project
# --------------------------------------------------

FRONTEND_PROJECT_NAME="${PROJECT_NAME}-frontend"
echo "Creating Frontend CodeBuild project: $FRONTEND_PROJECT_NAME"

# Frontend environment variables (only needs PROJECT_TIMESTAMP)
FRONTEND_ENV_VARS='{
    "name":  "PROJECT_TIMESTAMP",
    "value": "'"$TIMESTAMP"'",
    "type":  "PLAINTEXT"
  }'

FRONTEND_ENVIRONMENT='{
  "type": "LINUX_CONTAINER",
  "image": "aws/codebuild/amazonlinux-x86_64-standard:5.0",
  "computeType": "BUILD_GENERAL1_MEDIUM",
  "environmentVariables": ['"$FRONTEND_ENV_VARS"']
}'

# Frontend buildspec
FRONTEND_SOURCE='{
  "type":"GITHUB",
  "location":"https://github.com/ASUCICREPO/PDF_accessability_UI.git",
  "buildspec":"buildspec-frontend.yml"
}'

echo "Creating Frontend CodeBuild project '$FRONTEND_PROJECT_NAME'..."
aws codebuild create-project \
  --name "$FRONTEND_PROJECT_NAME" \
  --source "$FRONTEND_SOURCE" \
  --source-version "$SOURCE_VERSION" \
  --artifacts "$ARTIFACTS" \
  --environment "$FRONTEND_ENVIRONMENT" \
  --service-role "$ROLE_ARN" \
  --output json

if [ $? -ne 0 ]; then
  echo "✗ Failed to create frontend CodeBuild project"
  exit 1
fi

# --------------------------------------------------
# 6. Start Frontend Build and Wait for Completion
# --------------------------------------------------

echo "Starting frontend build for project '$FRONTEND_PROJECT_NAME'..."
FRONTEND_BUILD_ID=$(aws codebuild start-build \
  --project-name "$FRONTEND_PROJECT_NAME" \
  --query 'build.id' \
  --output text)

if [ $? -ne 0 ]; then
  echo "✗ Failed to start the frontend build"
  exit 1
fi

echo "✓ Frontend build started successfully. Build ID: $FRONTEND_BUILD_ID"

# Wait for frontend build to complete
echo "Waiting for frontend build to complete..."
BUILD_STATUS="IN_PROGRESS"

while [ "$BUILD_STATUS" = "IN_PROGRESS" ]; do
  sleep 15
  BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$FRONTEND_BUILD_ID" --query 'builds[0].buildStatus' --output text)
  echo "Frontend build status: $BUILD_STATUS"
done

if [ "$BUILD_STATUS" != "SUCCEEDED" ]; then
  echo "❌ Frontend build failed with status: $BUILD_STATUS"
  echo "Check CodeBuild logs for details: https://console.aws.amazon.com/codesuite/codebuild/projects/$FRONTEND_PROJECT_NAME/build/$FRONTEND_BUILD_ID/"
  exit 1
fi

echo "✅ Frontend build completed successfully!"

# --------------------------------------------------
# 7. Retrieve Final Deployment Info
# --------------------------------------------------

echo "🔍 Retrieving final deployment information..."

AMPLIFY_APP_ID=$(aws ssm get-parameter \
  --name "/pdf-ui/$TIMESTAMP/amplify-app-id" \
  --query 'Parameter.Value' \
  --output text)

STACK_NAME=$(aws ssm get-parameter \
  --name "/pdf-ui/$TIMESTAMP/stack-name" \
  --query 'Parameter.Value' \
  --output text)

# --------------------------------------------------
# 8. Cleanup SSM Parameters
# --------------------------------------------------

echo "🧹 Cleaning up temporary SSM parameters..."
aws ssm delete-parameter --name "/pdf-ui/$TIMESTAMP/amplify-app-id" >/dev/null 2>&1 || true
aws ssm delete-parameter --name "/pdf-ui/$TIMESTAMP/stack-name" >/dev/null 2>&1 || true

# --------------------------------------------------
# 9. Final Summary
# --------------------------------------------------

echo ""
echo "🎉 Two-Stage Deployment Complete!"
echo "📊 Summary:"
echo "  - Backend Project: $BACKEND_PROJECT_NAME"
echo "  - Frontend Project: $FRONTEND_PROJECT_NAME"
echo "  - CDK Stack: $STACK_NAME"
echo "  - Amplify App: $AMPLIFY_APP_ID"
echo "  - Frontend URL: https://main.${AMPLIFY_APP_ID}.amplifyapp.com"
echo ""
echo "Current CodeBuild projects:"
aws codebuild list-projects --output table

exit 0
