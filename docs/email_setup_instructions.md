# Custom Email Setup Guide (`rashscore.live` via Squarespace + Gmail)

Follow these steps to set up custom emails (like `hey@rashscore.live`, `contact@rashscore.live`) to forward to your personal Gmail account and allow you to reply/send emails as `hey@rashscore.live` directly from your personal Gmail inbox for free.

---

## Step 1: Set up Email Forwarding in Squarespace

Squarespace provides free email forwarding. This forwards incoming mail sent to `hey@rashscore.live` to your personal Gmail inbox.

1. Go to your **Squarespace Account Dashboard**.
2. Click **Domains** and select `rashscore.live`.
3. In the domain settings menu, click **Email** (or Email Forwarding).
4. Click **Add Rule** (or Add Forwarding).
5. In the **Alias** field, type `hey` (this configures `hey@rashscore.live`).
6. In the **Forward To** field, type your **personal Gmail address** (e.g. `yourname@gmail.com`).
7. Click **Save** / **Add**.
8. *(Optional)* Add other rules for other aliases like `contact` or `support` pointing to the same Gmail address.

*Test it: Send an email from a different account to `hey@rashscore.live`. It should arrive in your personal Gmail inbox.*

---

## Step 2: Generate a Google App Password

To configure Gmail to send mail as your custom domain, you must authenticate the SMTP connection using a Google App Password.

1. Go to your **[Google Account Settings](https://myaccount.google.com/)**.
2. Navigate to **Security** in the left sidebar.
3. Under **How you sign in to Google**, ensure **2-Step Verification** is turned **ON** (this is required to generate App Passwords).
4. Click on **2-Step Verification** and scroll to the bottom, then click on **App Passwords**.
5. In the fields:
   * **App Name**: Type a custom name like `Squarespace SMTP`.
6. Click **Create**.
7. Google will display a **16-character password** in a yellow box (e.g., `abcd efgh ijkl mnop`). **Copy this password** — you will not see it again.

---

## Step 3: Configure Gmail to "Send Mail As"

Now, configure Gmail's outgoing server settings to authenticate as your custom alias.

1. Open your **personal Gmail account** on a desktop browser.
2. Click the gear icon (**Settings**) in the top right → select **See all settings**.
3. Go to the **Accounts and Import** tab.
4. Scroll down to the **Send mail as:** section and click **Add another email address**.
5. In the pop-up window:
   * **Name**: The name you want recipients to see (e.g. `rAsh Score` or your name).
   * **Email address**: `hey@rashscore.live`
   * **Treat as an alias**: Check this box.
6. Click **Next Step**.
7. In the SMTP Server configuration window, enter the following details:
   * **SMTP Server**: `smtp.gmail.com`
   * **Port**: `587`
   * **Username**: Your **full personal Gmail address** (e.g. `yourname@gmail.com`).
   * **Password**: Paste the **16-character App Password** you copied in **Step 2** (with no spaces).
   * Choose **Secured connection using TLS** (recommended).
8. Click **Add Account**.

---

## Step 4: Verify the Custom Email Address

1. Gmail will send a verification code to `hey@rashscore.live`.
2. Since you enabled email forwarding in Step 1, this verification email will arrive directly in your personal Gmail inbox.
3. Open the email, copy the verification code, paste it back into the pop-up window, and click **Verify**.

---

## Step 5: Configure Automatic Replies in Gmail

To ensure Gmail replies from `hey@rashscore.live` when responding to emails sent to that alias:

1. Open Gmail **Settings → Accounts and Import**.
2. Scroll to the **Send mail as** section.
3. Under *"When replying to a message"*, select **"Reply from the same address the message was sent to"**.

---

## Step 6: Optimize DNS Records for Spam Prevention (Recommended)

To make sure your custom emails don't end up in your recipients' spam folders, configure the SPF (Sender Policy Framework) record in Squarespace:

1. Go to your **Squarespace Domains Settings** → select `rashscore.live` → **DNS Settings**.
2. Add a new **TXT** record:
   * **Host/Name**: `@`
   * **Value/Data**: `v=spf1 include:_spf.google.com ~all`
   * *(Note: If an SPF record starting with `v=spf1` already exists, edit it to include `include:_spf.google.com` before the end term like `~all` or `-all` rather than creating a duplicate TXT record).*
