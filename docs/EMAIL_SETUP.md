# Email System Setup Guide

## Overview

The E-TicketsZW platform sends transactional emails for:
1. **Buyer Ticket Delivery** - Contains downloadable ticket PNG attachment
2. **Organizer Sale Notifications** - Notifies organizer of ticket sales
3. **Admin Sales Reports** - Financial summary for platform admins

## Prerequisites

### 1. Resend Email Service
- Email delivery is powered by [Resend](https://resend.com)
- Resend API key is **required** for emails to be sent
- Without it, emails are silently skipped with error logs

### 2. Environment Variables Required

Set these in your Vercel environment or `.env.local`:

```bash
# Resend Email Service (REQUIRED)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# Optional: Custom email sender address
# Defaults to: E-TicketsZW <pay@eticket.co.zw>
EMAIL_FROM=your-email@domain.com
```

## Setup Steps

### Step 1: Get Resend API Key
1. Go to [Resend Dashboard](https://resend.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `re_`)

### Step 2: Configure in Vercel
1. Go to Vercel Project Settings → Environment Variables
2. Add `RESEND_API_KEY` with your API key value
3. Select environments: Production, Preview, Development
4. Save and redeploy

### Step 3: Configure Email Domain (Recommended)
For production use, configure a custom domain in Resend:
1. In Resend dashboard, go to Domains
2. Add your domain (e.g., `mail.yourdomain.com`)
3. Add DNS records as instructed
4. Update `EMAIL_FROM` environment variable

### Step 4: Test Email Sending
1. Create a test event
2. Purchase a test ticket with a real email address
3. Check your email inbox for:
   - **Buyer Email**: Ticket confirmation with PNG attachment
   - **Organizer Email**: Sale notification
   - **Sales Inbox**: Admin report

## Email Types

### 1. Ticket Confirmation Email
**Recipient**: Buyer's email address
**Contains**:
- Welcome message
- Event details (date, time, venue)
- Ticket information
- Attached: Ticket PNG file

**Triggered**: Immediately after payment confirmation

### 2. Sale Notification Email
**Recipients**: 
- Organizer (event owner)
- Admin (sales@eticket.co.zw)

**Contains**:
- Buyer information
- Sale details
- Financial breakdown (for admin)

**Triggered**: Simultaneously with ticket email

## Troubleshooting

### Issue: Emails Not Arriving
**Causes & Solutions**:
1. **RESEND_API_KEY not set**
   - Check Vercel environment variables
   - Verify variable is set for correct environment (production/preview)
   - Redeploy after setting variable

2. **Email address invalid or missing**
   - Check that buyer entered valid email at checkout
   - Verify `buyerEmail` is in payment metadata

3. **Resend account not verified**
   - Complete email verification in Resend dashboard
   - Verify domain DNS records are configured

4. **API key expired or invalid**
   - Check API key hasn't been revoked
   - Create new API key if needed

### Issue: Email Delivery Slow
**Solutions**:
- Resend typically delivers within seconds
- Check Resend dashboard activity log for delivery status
- Verify email isn't in spam folder

### Debugging

Check error logs for email-related errors:
- Look for messages starting with "CRITICAL: RESEND_API_KEY"
- Look for "ticket_email_send_failed" or "sale_notification_emails_not_sent"
- Check Resend dashboard activity logs

## Fallback: Manual Download

Even if emails fail, buyers can:
1. Visit their confirmation page at `/tickets/confirmation?ref=<reference>`
2. Download ticket PNG directly
3. View QR code for entry

## Production Checklist

- [ ] RESEND_API_KEY configured in Vercel
- [ ] Custom domain configured in Resend (recommended)
- [ ] EMAIL_FROM updated with custom domain
- [ ] Test payment completed and email received
- [ ] Buyer email verified
- [ ] Organizer email verified
- [ ] Admin email (sales@eticket.co.zw) configured
- [ ] Monitoring: Error logs checked regularly

## Monitoring

### Error Tracking
Errors are logged with context:
- `ticket_email_send_failed` - Buyer email failed
- `sale_notification_emails_not_sent` - Sale email failed
- `ticket_email_generation_failed` - Ticket PNG generation failed

### Email Status API
Endpoint: `/api/tickets/{id}/status`
Returns: Ticket status, payment info, email delivery status (future enhancement)

## Cost Estimation

Resend Pricing:
- **Free tier**: 100 emails/day
- **Standard**: $20/month for 50,000 emails/month
- Each ticket purchase = 2 emails (buyer + organizer)

Example:
- 100 tickets/day = 200 emails/day
- Monthly: 6,000 emails = $20/month plan

## Support

For email issues:
1. Check error logs in Vercel
2. Verify Resend account status and limits
3. Test with personal email address
4. Check Resend dashboard activity
5. Contact Resend support if API issue
