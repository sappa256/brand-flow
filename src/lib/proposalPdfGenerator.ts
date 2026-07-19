import jsPDF from 'jspdf';
import type { Proposal, Lead } from '@/types/crm';
import { format } from 'date-fns';
import { LOGO_BASE64 } from '@/assets/logoBase64';

interface ProposalWithLead extends Proposal {
  lead?: Lead | null;
}

const COMPANY_INFO = {
  name: 'MONTAZ MEDIAS',
  tagline: 'INSPIRE . VISUALIZE . EXECUTE',
  contact: 'K Swathi Priyanka',
  phone: '+91 9908455325',
  website: 'www.montazmedias.in',
  address: 'Seethammadhara, Vizag',
};

const PLAN_DETAILS = {
  essential: { reelsPerMonth: 8, shootDays: 2, fee: 45000 },
  accelerator: { reelsPerMonth: 12, shootDays: 3, fee: 75000 },
  dominator: { reelsPerMonth: 20, shootDays: 4, fee: 100000 },
};

// Safe date formatter to prevent throwing errors on strings like "To Be Decided"
function safeFormatDate(dateStr: string | null | undefined, fallback: string = 'To Be Decided'): string {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return dateStr;
  }
  return format(date, 'do MMMM yyyy');
}

// Generate dynamic service bullets list based on reels count to adopt custom templates
function getServicesList(reelsPerMonth: number): string[] {
  const reelsPerWeek = Math.round(reelsPerMonth / 4);
  
  if (reelsPerMonth >= 20) {
    return [
      'Competitor Research: Comprehensive analysis of competitors within the Client\'s industry to understand trends, strategies, and opportunities.',
      `Ideation & Scripting (Approx. ${reelsPerMonth} Content Pieces per Month): We will create engaging and creative scripts tailored to the Client\'s brand, delivering:`,
      `**${reelsPerWeek} Instagram Reels per week**`,
      `**2 Instagram Posts (Carousels/Images) per week**`,
      `Video Shoot & Editing for ${reelsPerMonth} Instagram Reels per month: Professional Shoot & Editing, including captions, Color correction, and engaging visual elements.`,
      'Instagram Account Management: Full management of the Client\'s Instagram account, including but not limited to Posting content (reels, Posts, stories)',
      'Posting content (reels, Posts, stories)',
      'Engaging with followers and responding to comments',
      'Monitoring account performance and analytics',
      'Social media engagement tasks: replying to comments, managing DMs, and interacting with followers.',
      'Strategy adjustments based on performance and engagement metrics.',
      'Monthly Performance Reports: Regular reports on engagement metrics, follower growth, and content performance analysis.'
    ];
  } else {
    return [
      'Competitor Research: Basic research of industry competitors to guide content positioning.',
      `Ideation & Scripting for ${reelsPerMonth} Instagram Reels per month: Engaging and creative scripts tailored to the brand.`,
      `Video Editing for ${reelsPerMonth} Instagram Reels per month: Professional post-production, sound engineering, and color grading.`,
      'Instagram Account Management: Full management of the Client\'s Instagram account, including but not limited to:',
      'Posting content (reels, stories, etc.)',
      'Engaging with followers and responding to comments',
      'Monitoring account performance and analytics',
      'Social media engagement tasks: replying to comments, managing DMs, and interacting with followers.',
      'Strategy adjustments based on performance and engagement metrics.',
      'Monthly Performance Reports: Regular reports on engagement metrics, follower growth, and content performance analysis.'
    ];
  }
}

// Draw the colorful logo icon and text
function drawHeaderLogo(doc: jsPDF, x: number, y: number): void {
  // Dark circle background emblem
  doc.setFillColor(15, 23, 42); // slate 900
  doc.ellipse(x + 6, y + 6, 6, 6, 'F');

  // Draw the custom brand logo centered inside the dark circle (8x6)
  doc.addImage(LOGO_BASE64, 'PNG', x + 2, y + 3, 8, 6);

  // Text beside the emblem
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(COMPANY_INFO.name, x + 16, y + 5);

  doc.setTextColor(100, 116, 139); // slate 500
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(COMPANY_INFO.tagline, x + 16, y + 9);
}

// Draw the bottom right abstract graphic ribbons / logo watermark
function drawFooterRibbons(doc: jsPDF, isCoverPage: boolean): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Draw the large brand ribbon peaking from the bottom right corner (110x82.5)
  doc.addImage(LOGO_BASE64, 'PNG', pageWidth - 110, pageHeight - 82.5, 110, 82.5);
}

// Helper to draw text paragraph with formatting, inline bolding, and pagination support
function drawRichTextParagraph(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  fontSize: number = 10,
  lineHeight: number = 5,
  isBullet: boolean = false,
  bulletOffset: number = 6
): number {
  doc.setFontSize(fontSize);
  
  const textWidth = isBullet ? width - bulletOffset : width;
  const drawX = isBullet ? x + bulletOffset : x;
  
  const lines = doc.splitTextToSize(text, textWidth);
  let currentY = y;
  let isCurrentlyBold = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (currentY > doc.internal.pageSize.getHeight() - 25) {
      doc.addPage();
      drawFooterRibbons(doc, false);
      currentY = 25;
      doc.setFontSize(fontSize);
    }
    
    if (isBullet && i === 0) {
      doc.setFont('helvetica', 'normal');
      const bulletX = bulletOffset === 12 ? x + 6 : x;
      doc.text('•', bulletX, currentY);
    }
    
    const parts = lines[i].split('**');
    let currentX = drawX;
    
    parts.forEach((part: string, index: number) => {
      if (index > 0) {
        isCurrentlyBold = !isCurrentlyBold;
      }
      doc.setFont('helvetica', isCurrentlyBold ? 'bold' : 'normal');
      doc.text(part, currentX, currentY);
      currentX += doc.getTextWidth(part);
    });
    
    currentY += lineHeight;
  }
  
  return currentY;
}

export function generateProposalPdf(proposal: ProposalWithLead): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Safely fallback undefined database fields
  const clientName = proposal.client_name || 'Client';
  const planType = (proposal.plan_type || 'essential').toLowerCase();
  
  // Safe plan lookup fallback to prevent crash on custom/unrecognized plans
  const planDetails = PLAN_DETAILS[planType as keyof typeof PLAN_DETAILS] || PLAN_DETAILS.essential;
  
  const reelsPerMonth = proposal.reels_per_month || planDetails.reelsPerMonth || 8;
  const shootDaysPerMonth = proposal.shoot_days_per_month || planDetails.shootDays || 2;
  const contractDurationMonths = proposal.contract_duration_months || 6;
  const monthlyFee = proposal.monthly_fee || 45000;
  const totalValue = monthlyFee * contractDurationMonths;

  // Cover page colors
  const pinkColor: [number, number, number] = [236, 72, 153];
  const darkColor: [number, number, number] = [40, 40, 40];
  const grayColor: [number, number, number] = [100, 100, 100];

  // ============ COVER PAGE ============
  // Header Logo
  drawHeaderLogo(doc, margin, 20);

  // Big Title: AGENCY PROPOSAL
  doc.setFontSize(44);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('AGENCY', margin, 78);
  doc.setTextColor(...pinkColor);
  doc.text('PROPOSAL', margin, 96);

  // Motto list
  doc.setFontSize(14);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'normal');
  doc.text('INSPIRE', margin, 114);
  doc.text('VISUALIZE', margin, 122);
  doc.text('EXECUTE', margin, 130);

  // Date at bottom-left
  const proposalDate = format(new Date(), 'dd.MM.yyyy');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkColor);
  doc.text(proposalDate, margin, pageHeight - 70);

  // Prepared For & By Section
  const preparedByY = pageHeight - 60;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Prepared for', margin, preparedByY);
  doc.setFont('helvetica', 'normal');
  
  // Safe multi-line drawing for client names containing newlines
  const clientLines = clientName.toUpperCase().split('\n');
  clientLines.forEach((line, index) => {
    doc.text(line, margin, preparedByY + 6 + (index * 5));
  });

  doc.setFont('helvetica', 'bold');
  doc.text('Prepared by', margin + 70, preparedByY);
  doc.setFont('helvetica', 'italic');
  doc.text(COMPANY_INFO.contact, margin + 70, preparedByY + 6);
  doc.text(COMPANY_INFO.name, margin + 70, preparedByY + 12);
  
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.phone, margin + 70, preparedByY + 18);
  doc.text(COMPANY_INFO.website, margin + 70, preparedByY + 24);

  // Decorative right-side ribbons (Cover Page)
  drawFooterRibbons(doc, true);

  // ============ PAGE 2: SERVICE AGREEMENT ============
  doc.addPage();
  drawFooterRibbons(doc, false);

  let yPos = 25;

  // Main Headers (Centered)
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('PERSONAL BRANDING AGENCY', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;
  doc.text('SERVICE AGREEMENT', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Intro Statement
  const introText = `This Agreement is made and entered into on the day of ${format(new Date(), "do 'of' MMMM, yyyy")}, by and between:`;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const introLines = doc.splitTextToSize(introText, contentWidth);
  introLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  });
  yPos += 7;

  // Client Block
  doc.setFont('helvetica', 'bold');
  doc.text('Client:', margin, yPos);
  yPos += 5;
  
  // Safe client name printing
  clientLines.forEach((line) => {
    doc.text(line, margin, yPos);
    yPos += 5;
  });
  
  if (proposal.lead?.niche) {
    doc.text(proposal.lead.niche.toUpperCase(), margin, yPos);
    yPos += 5;
  }
  yPos += 5;

  // Recitals
  doc.setFont('helvetica', 'bold');
  doc.text('Recitals', margin, yPos);
  yPos += 5;
  const recitalsText = `WHEREAS, the Service Provider (${COMPANY_INFO.name}) is in the business of offering personal branding services, including competitor research, ideation scripting, video editing, and Instagram account management; AND WHEREAS, the Client desires to engage the Service Provider to provide such services.`;
  yPos = drawRichTextParagraph(doc, recitalsText, margin, yPos, contentWidth, 10, 5) + 3;

  const mutualText = `NOW, THEREFORE, in consideration of the mutual promises and covenants contained herein, the parties agree as follows:`;
  yPos = drawRichTextParagraph(doc, mutualText, margin, yPos, contentWidth, 10, 5) + 8;

  // Section 1: Scope of Services
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Scope of Services', margin, yPos);
  yPos += 6;

  yPos = drawRichTextParagraph(doc, `The Service Provider agrees to provide the following services for the Client:`, margin, yPos, contentWidth, 10, 5) + 3;

  // Dynamic services resolving
  const services = getServicesList(reelsPerMonth);
  services.forEach((service, index) => {
    const isNestedReels = reelsPerMonth >= 20 && (index === 2 || index === 3);
    const isNestedAccount = reelsPerMonth >= 20 ? (index >= 6 && index <= 9) : (index >= 4 && index <= 7);
    
    yPos = drawRichTextParagraph(
      doc, 
      service, 
      margin, 
      yPos, 
      contentWidth, 
      10, 
      5, 
      isNestedReels ? false : true, 
      isNestedReels ? 12 : (isNestedAccount ? 12 : 6)
    );
  });

  // ============ PAGE 3: TIMELINE & CONTRACT DETAILS ============
  doc.addPage();
  drawFooterRibbons(doc, false);
  yPos = 25;

  // Section 2: Timeline
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Timeline', margin, yPos);
  yPos += 6;

  const timelinePoints = [
    `Start Date: **To Be Decided**`,
    `Completion Date: **${safeFormatDate(proposal.accepted_date || proposal.sent_date)}** (${contractDurationMonths}-month contract)`,
    `The Service Provider will deliver ${reelsPerMonth >= 20 ? `approximately **${reelsPerMonth} total content pieces (Reels and Posts)**` : `**${reelsPerMonth} reels**`} every month for the duration of the ${contractDurationMonths}-month contract.`
  ];
  timelinePoints.forEach(pt => {
    yPos = drawRichTextParagraph(doc, pt, margin, yPos, contentWidth, 10, 5, true) + 1;
  });
  yPos += 4;

  // Section 3: Payment Terms
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('3. Payment Terms', margin, yPos);
  yPos += 6;

  const paymentPoints = [
    `The total fee for the services described above is **${monthlyFee.toLocaleString('en-IN')} INR** per month, totaling **${totalValue.toLocaleString('en-IN')} INR** for ${contractDurationMonths} months.`,
    `A payment of **${monthlyFee.toLocaleString('en-IN')} INR** is due every month on the same date as the first month's payment.`,
    `Payment Method: **Online Bank Transfer / Cash** (Without GST)`,
    `Invoices must be paid within **7 days** after receipt.`
  ];
  paymentPoints.forEach(pt => {
    yPos = drawRichTextParagraph(doc, pt, margin, yPos, contentWidth, 10, 5, true) + 1;
  });
  yPos += 4;

  // Section 4: Client Responsibilities
  doc.setFont('helvetica', 'bold');
  doc.text('4. Client Responsibilities', margin, yPos);
  yPos += 6;

  const clientRespPoints = [
    'The Client will provide all necessary assets, such as logos, brand guidelines, and any required content, for content creation and account management.',
    'The Client agrees to provide timely feedback and collaborate effectively on revisions and strategies.'
  ];
  clientRespPoints.forEach(pt => {
    yPos = drawRichTextParagraph(doc, pt, margin, yPos, contentWidth, 10, 5, true) + 1;
  });
  yPos += 4;

  // Section 5: Revisions
  doc.setFont('helvetica', 'bold');
  doc.text('5. Revisions', margin, yPos);
  yPos += 6;
  yPos = drawRichTextParagraph(doc, 'The Client is entitled to **one round of revisions** for each reel.', margin, yPos, contentWidth, 10, 5, true) + 4;

  // Section 6: Intellectual Property Rights
  doc.setFont('helvetica', 'bold');
  doc.text('6. Intellectual Property Rights', margin, yPos);
  yPos += 6;

  const ipPoints = [
    'All content created by the Service Provider, including video edits, scripts, and designs, will remain the property of the Service Provider until the Client makes full payment.',
    'Upon full payment, the Client will own all content created under this Agreement.'
  ];
  ipPoints.forEach(pt => {
    yPos = drawRichTextParagraph(doc, pt, margin, yPos, contentWidth, 10, 5, true) + 1;
  });
  yPos += 4;

  // Section 7: Confidentiality
  doc.setFont('helvetica', 'bold');
  doc.text('7. Confidentiality', margin, yPos);
  yPos += 6;
  yPos = drawRichTextParagraph(
    doc, 
    'The Service Provider agrees to maintain the confidentiality of all proprietary information related to the Client\'s business during the term of this Agreement and for a period of **6 months** following the termination of the contract.', 
    margin, 
    yPos, 
    contentWidth, 
    10, 
    5, 
    true
  ) + 4;

  // Section 8: Termination of Contract
  doc.setFont('helvetica', 'bold');
  doc.text('8. Termination of Contract', margin, yPos);
  yPos += 6;

  const termIntro = 'This Agreement may be terminated in the following circumstances:';
  yPos = drawRichTextParagraph(doc, termIntro, margin, yPos, contentWidth, 10, 5) + 2;

  const termPoints = [
    'The Service Provider becomes unable to perform due to illness or other reasons.',
    'The Client\'s company ceases operation or faces financial insolvency.',
    'Either party may terminate the contract with **30 days\'** written notice.',
    'Upon termination, the Client agrees to pay all amounts due up to the termination date.',
    'Both parties agree to complete any pending work and, where applicable, delete proprietary information from their systems.'
  ];
  termPoints.forEach(pt => {
    yPos = drawRichTextParagraph(doc, pt, margin, yPos, contentWidth, 10, 5, true) + 1;
  });

  // ============ PAGE 4: MISCELLANEOUS & SIGNATURES ============
  doc.addPage();
  drawFooterRibbons(doc, false);
  yPos = 25;

  // Section 9: Modification Clause
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('9. Modification Clause', margin, yPos);
  yPos += 6;
  yPos = drawRichTextParagraph(doc, 'Any modifications or amendments to this contract must be in writing and signed by both parties before they become effective.', margin, yPos, contentWidth, 10, 5, true) + 4;

  // Section 10: Force Majeure
  doc.setFont('helvetica', 'bold');
  doc.text('10. Force Majeure', margin, yPos);
  yPos += 6;
  yPos = drawRichTextParagraph(doc, 'Neither party shall be held liable for any failure to perform due to circumstances beyond their control, such as natural disasters, pandemics, strikes, or other unforeseen events.', margin, yPos, contentWidth, 10, 5, true) + 4;

  // Section 11: Instagram Platform Responsibility
  doc.setFont('helvetica', 'bold');
  doc.text('11. Instagram Platform Responsibility', margin, yPos);
  yPos += 6;
  yPos = drawRichTextParagraph(doc, 'The Service Provider is not responsible for any changes to the Instagram platform, including algorithm updates, account suspensions, or downtime.', margin, yPos, contentWidth, 10, 5, true) + 4;

  // Section 12: Dispute Resolution
  doc.setFont('helvetica', 'bold');
  doc.text('12. Dispute Resolution', margin, yPos);
  yPos += 6;
  yPos = drawRichTextParagraph(
    doc, 
    'In the event of a dispute, both parties agree to first attempt to resolve the issue through good faith negotiation. If unresolved, disputes will be settled by **arbitration in Visakhapatnam, Andhra Pradesh**.', 
    margin, 
    yPos, 
    contentWidth, 
    10, 
    5, 
    true
  ) + 4;

  // Section 13: Governing Law
  doc.setFont('helvetica', 'bold');
  doc.text('13. Governing Law', margin, yPos);
  yPos += 6;
  yPos = drawRichTextParagraph(doc, 'This Agreement will be governed by and construed in accordance with the laws of **Andhra Pradesh, India**.', margin, yPos, contentWidth, 10, 5, true) + 4;

  // Section 14: Miscellaneous
  doc.setFont('helvetica', 'bold');
  doc.text('14. Miscellaneous', margin, yPos);
  yPos += 6;

  const miscPoints = [
    '**Entire Agreement**: This Agreement constitutes the entire understanding between the parties and supersedes any previous agreements.',
    '**Amendments**: Any amendments must be agreed upon in writing by both parties.'
  ];
  miscPoints.forEach(pt => {
    yPos = drawRichTextParagraph(doc, pt, margin, yPos, contentWidth, 10, 5, true) + 1;
  });
  yPos += 10;

  yPos = drawRichTextParagraph(doc, 'IN WITNESS WHEREOF, the parties here to have executed this Service Agreement as of the day and year first written above.', margin, yPos, contentWidth, 10, 5) + 18;

  // Signature Block
  if (yPos > pageHeight - 40) {
    doc.addPage();
    drawFooterRibbons(doc, false);
    yPos = 35;
  }
  const signatureY = yPos + 10;
  
  // Vector signature lines aligned perfectly to margins
  doc.setDrawColor(15, 23, 42); 
  doc.setLineWidth(0.5);
  doc.line(margin, signatureY, margin + 60, signatureY);
  doc.line(pageWidth - margin - 60, signatureY, pageWidth - margin, signatureY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const providerCenterX = margin + 30;
  const clientCenterX = pageWidth - margin - 30;
  
  doc.text(COMPANY_INFO.name + ' (Provider)', providerCenterX, signatureY + 6, { align: 'center' });
  
  // Handle multi-line client signature rendering centered
  const sigClientLines = clientName.split('\n');
  sigClientLines.forEach((line, idx) => {
    const val = idx === sigClientLines.length - 1 ? `${line} (Client)` : line;
    doc.text(val, clientCenterX, signatureY + 6 + (idx * 5), { align: 'center' });
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text(`Generated on ${format(new Date(), 'dd.MM.yyyy')}`, pageWidth / 2, pageHeight - 15, { align: 'center' });

  // Save the PDF
  const fileName = `Proposal_${clientName.replace(/\s+/g, '_').replace(/\n/g, '_')}_${format(new Date(), 'MMM_yyyy')}.pdf`;
  doc.save(fileName);
}
