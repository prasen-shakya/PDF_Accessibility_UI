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

  # Wait for propagation
  echo "✓ IAM role created"
  echo "Waiting for IAM role to propagate for 10 seconds..."
  sleep 10
fi

# --------------------------------------------------
# 3. Create CodeBuild project
# --------------------------------------------------

echo "Creating CodeBuild project: $PROJECT_NAME"

# --------------------------------------------------
# Build environment with explicit environmentVariables
# --------------------------------------------------

# Build environment variables array - only include buckets that are provided
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

ENVIRONMENT='{
  "type": "LINUX_CONTAINER",
  "image": "aws/codebuild/amazonlinux-x86_64-standard:5.0",
  "computeType": "BUILD_GENERAL1_SMALL",
  "environmentVariables": ['"$ENV_VARS_ARRAY"']
}'

# No artifacts
ARTIFACTS='{"type":"NO_ARTIFACTS"}'

# Source from GitHub
SOURCE='{"type":"GITHUB","location":"https://github.com/ASUCICREPO/PDF_accessability_UI.git"}'

# Which branch to build
SOURCE_VERSION="updatedUI"

echo "Creating CodeBuild project '$PROJECT_NAME' using GitHub repo 'https://github.com/ASUCICREPO/PDF_accessability_UI.git' ..."
aws codebuild create-project \
  --name "$PROJECT_NAME" \
  --source "$SOURCE" \
  --source-version "$SOURCE_VERSION" \
  --artifacts "$ARTIFACTS" \
  --environment "$ENVIRONMENT" \
  --service-role "$ROLE_ARN" \
  --output json \
  --no-cli-pager

if [ $? -eq 0 ]; then
  echo "✓ CodeBuild project '$PROJECT_NAME' created successfully."
else
  echo "✗ Failed to create CodeBuild project. Please verify AWS CLI permissions and parameters."
  exit 1
fi

# --------------------------------------------------
# 4. Start the build
# --------------------------------------------------

echo "Starting build for project '$PROJECT_NAME'..."
aws codebuild start-build \
  --project-name "$PROJECT_NAME" \
  --no-cli-pager \
  --output json

if [ $? -eq 0 ]; then
  echo "✓ Build started successfully."
else
  echo "✗ Failed to start the build."
  exit 1
fi

# --------------------------------------------------
# 5. List existing CodeBuild projects
# --------------------------------------------------

echo "Current CodeBuild projects:"
aws codebuild list-projects --output table

# --------------------------------------------------
# End of script
# --------------------------------------------------
exit 0