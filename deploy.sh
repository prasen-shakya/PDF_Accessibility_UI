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
  "buildspec":"buildspec.yml"
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
  --output json \
  --no-cli-pager

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
  --output text \
  --no-cli-pager)

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
  BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$BACKEND_BUILD_ID" --query 'builds[0].buildStatus' --output text --no-cli-pager)
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

# Build frontend environment variables array
FRONTEND_ENV_VARS_ARRAY=""

# Add bucket variables if provided
if [ -n "${PDF_TO_PDF_BUCKET:-}" ]; then
  FRONTEND_ENV_VARS_ARRAY='{
      "name":  "PDF_TO_PDF_BUCKET",
      "value": "'"$PDF_TO_PDF_BUCKET"'",
      "type":  "PLAINTEXT"
    }'
fi

if [ -n "${PDF_TO_HTML_BUCKET:-}" ]; then
  if [ -n "$FRONTEND_ENV_VARS_ARRAY" ]; then
    FRONTEND_ENV_VARS_ARRAY="$FRONTEND_ENV_VARS_ARRAY,"
  fi
  FRONTEND_ENV_VARS_ARRAY="$FRONTEND_ENV_VARS_ARRAY"'{
      "name":  "PDF_TO_HTML_BUCKET",
      "value": "'"$PDF_TO_HTML_BUCKET"'",
      "type":  "PLAINTEXT"
    }'
fi

# Add CDK outputs as environment variables for frontend
add_frontend_env_var() {
  local name="$1"
  local value="$2"
  if [ -n "$value" ] && [ "$value" != "null" ]; then
    if [ -n "$FRONTEND_ENV_VARS_ARRAY" ]; then
      FRONTEND_ENV_VARS_ARRAY="$FRONTEND_ENV_VARS_ARRAY,"
    fi
    FRONTEND_ENV_VARS_ARRAY="$FRONTEND_ENV_VARS_ARRAY"'{
        "name":  "'"$name"'",
        "value": "'"$value"'",
        "type":  "PLAINTEXT"
      }'
  fi
}

add_frontend_env_var "REACT_APP_AMPLIFY_APP_URL" "$AMPLIFY_APP_URL"
add_frontend_env_var "REACT_APP_USER_POOL_ID" "$USER_POOL_ID"
add_frontend_env_var "REACT_APP_USER_POOL_CLIENT_ID" "$USER_POOL_CLIENT_ID"
add_frontend_env_var "REACT_APP_USER_POOL_DOMAIN" "$USER_POOL_DOMAIN"
add_frontend_env_var "REACT_APP_IDENTITY_POOL_ID" "$IDENTITY_POOL_ID"
add_frontend_env_var "REACT_APP_UPDATE_FIRST_SIGN_IN_ENDPOINT" "$UPDATE_FIRST_SIGN_IN_ENDPOINT"
add_frontend_env_var "REACT_APP_CHECK_UPLOAD_QUOTA_ENDPOINT" "$CHECK_UPLOAD_QUOTA_ENDPOINT"

FRONTEND_ENVIRONMENT='{
  "type": "LINUX_CONTAINER",
  "image": "aws/codebuild/amazonlinux-x86_64-standard:5.0",
  "computeType": "BUILD_GENERAL1_MEDIUM",
  "environmentVariables": ['"$FRONTEND_ENV_VARS_ARRAY"']
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
  --output json \
  --no-cli-pager

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
  --output text \
  --no-cli-pager)

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
  BUILD_STATUS=$(aws codebuild batch-get-builds --ids "$FRONTEND_BUILD_ID" --query 'builds[0].buildStatus' --output text --no-cli-pager)
  echo "Frontend build status: $BUILD_STATUS"
done

if [ "$BUILD_STATUS" != "SUCCEEDED" ]; then
  echo "❌ Frontend build failed with status: $BUILD_STATUS"
  echo "Check CodeBuild logs for details: https://console.aws.amazon.com/codesuite/codebuild/projects/$FRONTEND_PROJECT_NAME/build/$FRONTEND_BUILD_ID/"
  exit 1
fi

echo "✅ Frontend build completed successfully!"

# --------------------------------------------------
# 7. Retrieve All CDK Outputs
# --------------------------------------------------

echo "🔍 Retrieving CDK deployment information..."

STACK_NAME="CdkBackendStack"
echo "CDK Stack Name: $STACK_NAME"

# Function to get all CDK outputs
get_cdk_outputs() {
  aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --query 'Stacks[0].Outputs' \
    --output json
}

# Get all outputs
echo "Fetching all CDK outputs..."
CDK_OUTPUTS=$(get_cdk_outputs)

if [ $? -ne 0 ] || [ -z "$CDK_OUTPUTS" ] || [ "$CDK_OUTPUTS" = "null" ]; then
  echo "❌ Error: Could not retrieve CDK stack outputs"
  echo "Available stacks:"
  aws cloudformation list-stacks --query 'StackSummaries[?StackStatus==`CREATE_COMPLETE` || StackStatus==`UPDATE_COMPLETE`].StackName'
  exit 1
fi

echo "✅ Retrieved CDK outputs successfully"

# Extract individual outputs
AMPLIFY_APP_ID=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "AmplifyAppId") | .OutputValue')
AMPLIFY_APP_URL=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "AmplifyAppURL") | .OutputValue')
USER_POOL_ID=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "UserPoolId") | .OutputValue')
USER_POOL_CLIENT_ID=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "UserPoolClientId") | .OutputValue')
USER_POOL_DOMAIN=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "UserPoolDomain") | .OutputValue')
IDENTITY_POOL_ID=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "IdentityPoolId") | .OutputValue')
AUTHENTICATED_ROLE=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "AuthenticatedRole") | .OutputValue')
UPDATE_FIRST_SIGN_IN_ENDPOINT=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "UpdateFirstSignInEndpoint") | .OutputValue')
CHECK_UPLOAD_QUOTA_ENDPOINT=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "CheckUploadQuotaEndpoint") | .OutputValue')
UPDATE_ATTRIBUTES_API_ENDPOINT=$(echo "$CDK_OUTPUTS" | jq -r '.[] | select(.OutputKey == "UpdateAttributesApiEndpoint377B5108") | .OutputValue')

# Validate required outputs
if [ -z "$AMPLIFY_APP_ID" ] || [ "$AMPLIFY_APP_ID" = "null" ]; then
  echo "❌ Error: Could not find AmplifyAppId in CDK stack outputs"
  echo "Available outputs:"
  echo "$CDK_OUTPUTS" | jq .
  exit 1
fi

echo "✅ Found Amplify App ID: $AMPLIFY_APP_ID"
echo "✅ Found Amplify App URL: $AMPLIFY_APP_URL"
echo "✅ Found User Pool ID: $USER_POOL_ID"
echo "✅ Found User Pool Client ID: $USER_POOL_CLIENT_ID"

# --------------------------------------------------
# 8. Final Summary
# --------------------------------------------------

echo ""
echo "🎉 Two-Stage Deployment Complete!"
echo "📊 Summary:"
echo "  - Backend Project: $BACKEND_PROJECT_NAME"
echo "  - Frontend Project: $FRONTEND_PROJECT_NAME"
echo "  - CDK Stack: $STACK_NAME"
echo "  - Amplify App: $AMPLIFY_APP_ID"
echo "  - Frontend URL: $AMPLIFY_APP_URL"
echo ""
echo "🔧 Frontend Environment Variables (from CDK outputs):"
echo "  - User Pool ID: $USER_POOL_ID"
echo "  - User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "  - User Pool Domain: $USER_POOL_DOMAIN"
echo "  - Identity Pool ID: $IDENTITY_POOL_ID"
echo "  - Authenticated Role: $AUTHENTICATED_ROLE"
echo "  - Update First Sign-in Endpoint: $UPDATE_FIRST_SIGN_IN_ENDPOINT"
echo "  - Check Upload Quota Endpoint: $CHECK_UPLOAD_QUOTA_ENDPOINT"
echo "  - API Gateway Endpoint: $UPDATE_ATTRIBUTES_API_ENDPOINT"
echo ""
echo "Current CodeBuild projects:"
aws codebuild list-projects --output table --no-cli-pager

exit 0
