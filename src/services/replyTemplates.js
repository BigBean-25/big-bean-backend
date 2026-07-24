// Reply templates for all admin modules

const replaceVars = (str, vars = {}) =>
  str.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : '');

const TEMPLATES = {
  corporate_enquiries: [
    {
      key: 'default_reply',
      label: 'Default Reply',
      subject: 'Thank you for your Corporate Order Enquiry - Big Bean Café',
      message: `Hi {name},

Thank you for reaching out to Big Bean Café for corporate orders.

Our team has received your enquiry and will contact you shortly with menu options, pricing and available packages.

For urgent support, you can reply to this email or contact us directly.

Regards,
Big Bean Café Coffee Roasters`,
      whatsapp: `Hi {name}, thank you for your corporate order enquiry to Big Bean Café! Our team has received your request and will get back to you shortly. ☕`,
    },
    {
      key: 'proposal_sent',
      label: 'Proposal Sent',
      subject: 'Corporate Order Proposal - Big Bean Café',
      message: `Hi {name},

Thank you for your interest in Big Bean Café for your corporate requirements.

Please find attached our proposal for your review. We would love to discuss this further at your convenience.

Regards,
Big Bean Café Coffee Roasters`,
      whatsapp: `Hi {name}, we have sent across our corporate order proposal for Big Bean Café. Please check your email and let us know if you have any questions! ☕`,
    },
  ],

  franchise_enquiries: [
    {
      key: 'default_reply',
      label: 'Default Reply',
      subject: 'Thank you for your Franchise Enquiry - Big Bean Café',
      message: `Hi {name},

Thank you for your interest in partnering with Big Bean Café.

Our franchise team has received your enquiry. We will review the details and get back to you with the next steps.

Regards,
Big Bean Café Coffee Roasters`,
      whatsapp: `Hi {name}, thank you for your interest in a Big Bean Café franchise! Our team has received your enquiry and will be in touch with the next steps. ☕`,
    },
    {
      key: 'meeting_scheduled',
      label: 'Meeting Scheduled',
      subject: 'Franchise Meeting Scheduled - Big Bean Café',
      message: `Hi {name},

Thank you for your continued interest in the Big Bean Café franchise opportunity.

We have scheduled a meeting to discuss further. Our team will confirm the time and details shortly.

Regards,
Big Bean Café Coffee Roasters`,
      whatsapp: `Hi {name}, great news! We have scheduled a meeting to discuss your Big Bean Café franchise interest. Our team will confirm the details shortly. ☕`,
    },
  ],

  career_applications: [
    {
      key: 'application_received',
      label: 'Application Received',
      subject: 'Application Received - Big Bean Café',
      message: `Hi {name},

Thank you for applying to Big Bean Café.

We have received your application for {position}. Our team will review your profile and contact you if shortlisted.

Regards,
Big Bean Café HR Team`,
      whatsapp: `Hi {name}, we have received your application for {position} at Big Bean Café. Our HR team will review and get back to you. Thank you! ☕`,
    },
    {
      key: 'shortlisted',
      label: 'Shortlisted',
      subject: 'You have been shortlisted - Big Bean Café',
      message: `Hi {name},

Congratulations! You have been shortlisted for the next step at Big Bean Café.

Our team will contact you shortly for interview scheduling.

Regards,
Big Bean Café HR Team`,
      whatsapp: `Hi {name}, congratulations! You have been shortlisted at Big Bean Café. Our HR team will contact you shortly for next steps. ☕`,
    },
    {
      key: 'interview_scheduled',
      label: 'Interview Scheduled',
      subject: 'Interview Scheduled - Big Bean Café',
      message: `Hi {name},

Thank you for your interest in joining Big Bean Café.

We are pleased to inform you that your interview has been scheduled. Our team will contact you with the details shortly.

Regards,
Big Bean Café HR Team`,
      whatsapp: `Hi {name}, your interview at Big Bean Café has been scheduled! Our team will share the details shortly. ☕`,
    },
    {
      key: 'rejected',
      label: 'Application Update',
      subject: 'Update on your application - Big Bean Café',
      message: `Hi {name},

Thank you for your interest in Big Bean Café.

After careful review, we are unable to proceed with your application at this time. We appreciate your time and wish you the very best in your career.

Regards,
Big Bean Café HR Team`,
      whatsapp: `Hi {name}, thank you for applying to Big Bean Café. After review, we are unable to proceed at this time. We appreciate your interest and wish you the best. ☕`,
    },
    {
      key: 'selected',
      label: 'Selected / Offer',
      subject: 'Welcome to Big Bean Café!',
      message: `Hi {name},

Congratulations! We are pleased to inform you that you have been selected to join the Big Bean Café team.

Our HR team will contact you shortly with the offer details and joining formalities.

Regards,
Big Bean Café HR Team`,
      whatsapp: `Hi {name}, congratulations! You have been selected to join Big Bean Café! Our HR team will reach out with the offer details. ☕🎉`,
    },
  ],

  contact_enquiries: [
    {
      key: 'default_reply',
      label: 'Default Reply',
      subject: 'Thank you for contacting Big Bean Café',
      message: `Hi {name},

Thank you for contacting Big Bean Café.

Our team has received your message and will get back to you shortly.

Regards,
Big Bean Café Coffee Roasters`,
      whatsapp: `Hi {name}, thank you for contacting Big Bean Café! We received your message and will get back to you shortly. ☕`,
    },
    {
      key: 'resolved',
      label: 'Resolved',
      subject: 'Your enquiry has been resolved - Big Bean Café',
      message: `Hi {name},

Thank you for reaching out to Big Bean Café.

We are happy to let you know that your enquiry has been resolved. Please feel free to contact us again if you need further assistance.

Regards,
Big Bean Café Coffee Roasters`,
      whatsapp: `Hi {name}, your enquiry with Big Bean Café has been resolved. Feel free to reach out if you need anything else. ☕`,
    },
  ],

  reservations: [
    {
      key: 'confirmed',
      label: 'Reservation Confirmed',
      subject: 'Reservation Confirmed - Big Bean Café',
      message: `Hi {name},

Your reservation at Big Bean Café is confirmed.

Reservation Date: {date}
Time: {time}
Guests: {guests}

We look forward to welcoming you. Please arrive a few minutes early.

Regards,
Big Bean Café Coffee Roasters`,
      whatsapp: `Hi {name}, your reservation at Big Bean Café is confirmed! 📅 Date: {date} | Time: {time} | Guests: {guests}. We look forward to seeing you! ☕`,
    },
    {
      key: 'reminder',
      label: 'Reservation Reminder',
      subject: 'Reservation Reminder - Big Bean Café',
      message: `Hi {name},

This is a friendly reminder about your upcoming reservation at Big Bean Café.

Reservation Date: {date}
Time: {time}
Guests: {guests}

We look forward to seeing you!

Regards,
Big Bean Café Coffee Roasters`,
      whatsapp: `Hi {name}, reminder: your Big Bean Café reservation is coming up! 📅 Date: {date} | Time: {time}. See you soon! ☕`,
    },
    {
      key: 'cancelled',
      label: 'Reservation Cancelled',
      subject: 'Reservation Update - Big Bean Café',
      message: `Hi {name},

Your reservation request could not be confirmed or has been cancelled.

We apologize for the inconvenience. Please contact us or book another slot at your convenience.

Regards,
Big Bean Café Coffee Roasters`,
      whatsapp: `Hi {name}, we regret to inform you that your Big Bean Café reservation could not be confirmed. Please contact us to book another slot. ☕`,
    },
  ],
};

const getTemplates = (moduleName) => TEMPLATES[moduleName] || [];

const getTemplate = (moduleName, key) => {
  const list = getTemplates(moduleName);
  return list.find(t => t.key === key) || list[0] || null;
};

const applyVars = (template, vars = {}) => {
  if (!template) return { subject: '', message: '', whatsapp: '' };
  return {
    subject:  replaceVars(template.subject  || '', vars),
    message:  replaceVars(template.message  || '', vars),
    whatsapp: replaceVars(template.whatsapp || '', vars),
  };
};

module.exports = { getTemplates, getTemplate, applyVars, replaceVars };
