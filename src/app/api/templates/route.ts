import { NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/auth-helpers";

export async function GET(req: Request) {
  try {
    const authResult = await requireAuth();
    if (isAuthError(authResult)) return authResult;

    const templates = [
      {
        id: "shopify-report-download",
        name: "Shopify Report Download",
        description: "Logs into Shopify, navigates to analytics reports, and triggers a CSV export download.",
        steps: [
          {
            type: "open_url",
            label: "Open Shopify Login",
            config: { url: "https://shopify.com/login" },
          },
          {
            type: "type_text",
            label: "Enter Email",
            config: {
              selectors: { primary: "#account_email", css: "input[type='email']" },
              text: "admin@store.com",
            },
          },
          {
            type: "click_element",
            label: "Click Continue",
            config: {
              selectors: { primary: "button[type='submit']", text: "Continue" },
            },
          },
          {
            type: "type_text",
            label: "Enter Password",
            config: {
              selectors: { primary: "#account_password", css: "input[type='password']" },
              text: "",
              credentialId: "shopify-password-cred-id",
            },
          },
          {
            type: "click_element",
            label: "Click Log In",
            config: {
              selectors: { primary: "button[type='submit']", text: "Log in" },
            },
          },
          {
            type: "open_url",
            label: "Navigate to Reports",
            config: { url: "https://admin.shopify.com/store/reports" },
          },
          {
            type: "click_element",
            label: "Click Export",
            config: {
              selectors: { primary: "button[aria-label='Export reports']", text: "Export" },
            },
          },
          {
            type: "download_file",
            label: "Download Exported CSV",
            config: {
              selectors: { primary: "button.export-confirm-btn", text: "Confirm Export" },
              outputKey: "shopifyReportCsv",
            },
          },
        ],
      },
      {
        id: "crm-contacts-export",
        name: "CRM Export",
        description: "Logs into standard CRM, navigates to contact lists, selects all contacts, and downloads contacts export.",
        steps: [
          {
            type: "open_url",
            label: "Open CRM Portal",
            config: { url: "https://crm.example.com/login" },
          },
          {
            type: "type_text",
            label: "Enter Username",
            config: {
              selectors: { primary: "input[name='username']" },
              text: "crm_agent_1",
            },
          },
          {
            type: "type_text",
            label: "Enter Password",
            config: {
              selectors: { primary: "input[name='password']" },
              text: "",
              credentialId: "crm-password-cred-id",
            },
          },
          {
            type: "click_element",
            label: "Click Sign In",
            config: {
              selectors: { primary: "button.signin-btn", text: "Sign In" },
            },
          },
          {
            type: "open_url",
            label: "Navigate to Contacts",
            config: { url: "https://crm.example.com/contacts" },
          },
          {
            type: "click_element",
            label: "Select All Contacts",
            config: {
              selectors: { primary: "input.select-all-checkbox" },
            },
          },
          {
            type: "click_element",
            label: "Click Export",
            config: {
              selectors: { primary: "button#export-contacts-action", text: "Export Contacts" },
            },
          },
          {
            type: "download_file",
            label: "Download Contacts CSV",
            config: {
              selectors: { primary: "a.download-link-btn" },
              outputKey: "crmContactsExport",
            },
          },
        ],
      },
      {
        id: "generic-login-download",
        name: "Generic Login & Download",
        description: "Standard boilerplate flow: Log in, submit credentials, trigger action, and capture download file.",
        steps: [
          {
            type: "open_url",
            label: "Open Target Portal",
            config: { url: "https://portal.example.com/login" },
          },
          {
            type: "type_text",
            label: "Input Login ID",
            config: {
              selectors: { primary: "input#login-id" },
              text: "user_login_id",
            },
          },
          {
            type: "type_text",
            label: "Input Password",
            config: {
              selectors: { primary: "input#login-pass" },
              text: "",
              credentialId: "portal-password-cred-id",
            },
          },
          {
            type: "click_element",
            label: "Click Login Button",
            config: {
              selectors: { primary: "button.submit-button", text: "Submit" },
            },
          },
          {
            type: "click_element",
            label: "Trigger File Generation",
            config: {
              selectors: { primary: "button.generate-file-btn" },
            },
          },
          {
            type: "download_file",
            label: "Download File",
            config: {
              selectors: { primary: "a.download-link" },
              outputKey: "portalExportFile",
            },
          },
        ],
      },
    ];

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("Failed to load starter templates:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
