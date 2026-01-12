import jsPDF from 'jspdf';
import type { Contract, Client } from '@/types/crm';
import { format } from 'date-fns';

interface ContractWithClient extends Contract {
  client: Client;
}

const COMPANY_INFO = {
  name: 'Montaz Medias',
  tagline: 'VISION. STRATEGY. SUCCESS',
  contact: 'S Rajesh',
  phone: '+91 9908455325',
  website: 'www.montazmedias.in',
  address: 'Seethammadhara, Vizag',
};

const PLAN_DETAILS = {
  essential: {
    name: 'Essential',
    reelsPerMonth: 8,
    shootDays: 1,
    services: [
      'Strategy & Ideation',
      'Content Scripting',
      'Video Production (8 Reels per Month)',
      'Professional Video Editing',
      'Basic Account Management',
    ],
  },
  accelerator: {
    name: 'Accelerator',
    reelsPerMonth: 15,
    shootDays: 2,
    services: [
      'Competitor Research',
      'Strategy & Ideation',
      'Content Scripting',
      'Video Production (15 Reels per Month)',
      'Professional Video Editing with Motion Graphics',
      'Full Account Management',
      'Engagement & DM Management',
      'Monthly Performance Reports',
    ],
  },
  dominator: {
    name: 'Dominator',
    reelsPerMonth: 20,
    shootDays: 3,
    services: [
      'Logo Design & Brand Assets',
      'Comprehensive Competitor Research',
      'Strategy & Ideation',
      'Full Creative Scripting',
      'Video Production (20 Reels per Month)',
      'Premium Video Editing with Advanced Graphics',
      'Full Account Management',
      'Engagement & DM Management',
      'Story & Post Management',
      'Monitoring & Strategy Adjustments',
      'Monthly Performance Reports',
    ],
  },
};

export function generateContractPdf(contract: ContractWithClient): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Colors
  const primaryColor: [number, number, number] = [236, 72, 153]; // Pink
  const darkColor: [number, number, number] = [30, 30, 30];
  const grayColor: [number, number, number] = [100, 100, 100];

  // ============ COVER PAGE ============
  // Company name header
  doc.setFontSize(14);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.name.toUpperCase(), margin, 30);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text(COMPANY_INFO.tagline, margin, 36);

  // Main title
  doc.setFontSize(48);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('AGENCY', margin, 90);

  doc.setTextColor(...primaryColor);
  doc.text('CONTRACT', margin, 110);

  // Tagline under title
  doc.setFontSize(16);
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'normal');
  doc.text(COMPANY_INFO.tagline, margin, 130);

  // Prepared by section
  const preparedByY = pageHeight - 80;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Prepared by', margin, preparedByY);

  doc.setFont('helvetica', 'italic');
  doc.text(COMPANY_INFO.name, margin, preparedByY + 8);
  doc.text(COMPANY_INFO.contact, margin, preparedByY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...grayColor);
  doc.text(COMPANY_INFO.phone, margin, preparedByY + 24);
  doc.text(COMPANY_INFO.website, margin, preparedByY + 32);
  doc.text(COMPANY_INFO.address, margin, preparedByY + 40);

  // ============ PAGE 2: SERVICE AGREEMENT ============
  doc.addPage();

  let yPos = 30;

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('PERSONAL BRANDING AGENCY', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  doc.text('SERVICE AGREEMENT', pageWidth / 2, yPos, { align: 'center' });

  yPos += 15;

  // Agreement intro
  const agreementDate = format(new Date(contract.start_date), 'do MMMM, yyyy');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const introText = `This Agreement is made and entered into on the ${agreementDate}, by and between:`;
  doc.text(introText, pageWidth / 2, yPos, { align: 'center' });

  yPos += 15;

  // Client info
  doc.setFont('helvetica', 'bold');
  doc.text('Client:', margin, yPos);
  yPos += 6;
  doc.setTextColor(...primaryColor);
  doc.text(contract.client?.client_name?.toUpperCase() || 'CLIENT NAME', margin, yPos);
  if (contract.client?.brand_name) {
    yPos += 6;
    doc.text(contract.client.brand_name.toUpperCase(), margin, yPos);
  }

  yPos += 12;

  // Whereas clause
  doc.setTextColor(...darkColor);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const whereasText = `WHEREAS, the Service Provider (${COMPANY_INFO.name}) is in the business of offering personal branding, social media strategy, and technical setup services; AND WHEREAS, the Client desires to engage the Service Provider to provide such services.`;
  const whereasLines = doc.splitTextToSize(whereasText, contentWidth);
  doc.text(whereasLines, margin, yPos);
  yPos += whereasLines.length * 5 + 8;

  const nowText = 'NOW, THEREFORE, in consideration of the mutual promises and covenants contained herein, the parties agree as follows:';
  const nowLines = doc.splitTextToSize(nowText, contentWidth);
  doc.text(nowLines, margin, yPos);
  yPos += nowLines.length * 5 + 10;

  // Section 1: Scope of Services
  const planType = contract.client?.plan_type || 'accelerator';
  const planDetails = PLAN_DETAILS[planType];

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Scope of Services', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const scopeIntro = `The Service Provider agrees to provide the following ${planDetails.name} Package services for the Client's brand:`;
  const scopeLines = doc.splitTextToSize(scopeIntro, contentWidth);
  doc.text(scopeLines, margin, yPos);
  yPos += scopeLines.length * 5 + 6;

  // Services list
  planDetails.services.forEach((service, index) => {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 30;
    }
    doc.text(`• ${service}`, margin + 5, yPos);
    yPos += 6;
  });

  yPos += 8;

  // Section 2: Timeline
  if (yPos > pageHeight - 50) {
    doc.addPage();
    yPos = 30;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Timeline', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Start Date: ${format(new Date(contract.start_date), 'do MMMM yyyy')}`, margin, yPos);
  yPos += 6;
  doc.text(`Completion Date: ${format(new Date(contract.end_date), 'do MMMM yyyy')} (${contract.duration_months}-month contract)`, margin, yPos);
  yPos += 6;
  doc.text(`The Service Provider will deliver ${planDetails.reelsPerMonth} completed Reels every month for the duration of the contract.`, margin, yPos);

  yPos += 12;

  // Section 3: Payment Terms
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 30;
  }

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Payment Terms', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const totalValue = contract.monthly_retainer * contract.duration_months;
  doc.text(`The total fee for the services described above is ${contract.monthly_retainer.toLocaleString('en-IN')} INR per month (Monthly Retainer),`, margin, yPos);
  yPos += 5;
  doc.text(`totaling ${totalValue.toLocaleString('en-IN')} INR for ${contract.duration_months} months.`, margin, yPos);
  yPos += 8;
  doc.text(`A payment of ${contract.monthly_retainer.toLocaleString('en-IN')} INR is due every month on the start date.`, margin, yPos);
  yPos += 6;
  doc.text('Payment Method: Online Bank Transfer (Without GST).', margin, yPos);
  yPos += 6;
  doc.text('Invoices must be paid within 7 days after receipt.', margin, yPos);

  // ============ PAGE 3: MORE TERMS ============
  doc.addPage();
  yPos = 30;

  // Section 4: Client Responsibilities
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Client Responsibilities', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const clientResp = 'The Client will provide all necessary assets (logos, brand guidelines) and must be available for all scheduled shoots as required by the production calendar. The Client agrees to provide timely feedback and collaborate effectively on content revisions and strategies.';
  const clientRespLines = doc.splitTextToSize(clientResp, contentWidth);
  doc.text(clientRespLines, margin, yPos);
  yPos += clientRespLines.length * 5 + 10;

  // Section 5: Revisions
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Revisions', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('The Client is entitled to one round of revisions for each completed Reel (post-shoot/post-edit).', margin, yPos);
  yPos += 12;

  // Section 6: Intellectual Property Rights
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('6. Intellectual Property Rights', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const ipText = 'All content created by the Service Provider, including scripts and video edits, will remain the property of the Service Provider until the Client makes full payment. Upon full payment, the Client will own all content created under this Agreement.';
  const ipLines = doc.splitTextToSize(ipText, contentWidth);
  doc.text(ipLines, margin, yPos);
  yPos += ipLines.length * 5 + 10;

  // Section 7: Confidentiality
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('7. Confidentiality', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const confText = 'The Service Provider agrees to maintain the confidentiality of all proprietary information related to the Client\'s business during the term of this Agreement and for a period of 6 months following the termination of the contract.';
  const confLines = doc.splitTextToSize(confText, contentWidth);
  doc.text(confLines, margin, yPos);
  yPos += confLines.length * 5 + 10;

  // Section 8: Termination
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('8. Termination of Contract', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Either party may terminate the contract with 30 days\' written notice.', margin, yPos);
  yPos += 6;
  doc.text('Upon termination, the Client agrees to pay all amounts due up to the termination date.', margin, yPos);
  yPos += 6;
  const termText = 'Both parties agree to complete any pending work and, where applicable, delete proprietary information from their systems.';
  const termLines = doc.splitTextToSize(termText, contentWidth);
  doc.text(termLines, margin, yPos);
  yPos += termLines.length * 5 + 10;

  // Section 9: Liability
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('9. Limitation of Liability', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const liabilityText = 'The Service Provider\'s total liability under this Agreement shall not exceed the total fees paid by the Client.';
  doc.text(liabilityText, margin, yPos);

  // ============ PAGE 4: FINAL TERMS & SIGNATURES ============
  doc.addPage();
  yPos = 30;

  // Section 10: Force Majeure
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('10. Force Majeure', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const forceText = 'Neither party shall be held liable for any failure to perform due to circumstances beyond their control, such as natural disasters, pandemics, strikes, or other unforeseen events.';
  const forceLines = doc.splitTextToSize(forceText, contentWidth);
  doc.text(forceLines, margin, yPos);
  yPos += forceLines.length * 5 + 10;

  // Section 11: Platform Responsibility
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('11. Platform Responsibility', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const platformText = 'The Service Provider is not responsible for any direct outcomes (views, sales, etc.) resulting from the strategy, or for any changes to social media platforms, including algorithm updates, account suspensions, or downtime.';
  const platformLines = doc.splitTextToSize(platformText, contentWidth);
  doc.text(platformLines, margin, yPos);
  yPos += platformLines.length * 5 + 10;

  // Section 12: Dispute Resolution
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('12. Dispute Resolution', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const disputeText = 'In the event of a dispute, both parties agree to first attempt to resolve the issue through good faith negotiation. If unresolved, disputes will be settled by arbitration in Visakhapatnam, Andhra Pradesh.';
  const disputeLines = doc.splitTextToSize(disputeText, contentWidth);
  doc.text(disputeLines, margin, yPos);
  yPos += disputeLines.length * 5 + 10;

  // Section 13: Governing Law
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('13. Governing Law', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('This Agreement will be governed by and construed in accordance with the laws of Andhra Pradesh, India.', margin, yPos);
  yPos += 12;

  // Section 14: Miscellaneous
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('14. Miscellaneous', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setFont('helvetica', 'bold');
  doc.text('Entire Agreement:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(' This Agreement constitutes the entire understanding between the parties.', margin + 35, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Amendments:', margin, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(' Any amendments must be agreed upon in writing by both parties.', margin + 28, yPos);

  yPos += 20;

  // Execution Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Execution', margin, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const execText = 'IN WITNESS WHEREOF, the parties hereto have executed this Service Agreement as of the day and year first written above.';
  const execLines = doc.splitTextToSize(execText, contentWidth);
  doc.text(execLines, margin, yPos);
  yPos += execLines.length * 5 + 20;

  // Signature lines
  const signatureY = yPos + 10;
  const leftSignX = margin;
  const rightSignX = pageWidth / 2 + 10;

  // Service Provider signature
  doc.setFont('helvetica', 'bold');
  doc.text('_________________________', leftSignX, signatureY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${COMPANY_INFO.name}`, leftSignX, signatureY + 8);
  doc.text('(Service Provider)', leftSignX, signatureY + 14);

  // Client signature
  doc.text('_________________________', rightSignX, signatureY);
  doc.text(contract.client?.client_name || 'CLIENT NAME', rightSignX, signatureY + 8);
  doc.text('(Client)', rightSignX, signatureY + 14);

  // Footer with date
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text(`Generated on ${format(new Date(), 'dd MMM yyyy')}`, pageWidth / 2, pageHeight - 15, { align: 'center' });

  // Save the PDF
  const fileName = `Contract_${contract.client?.client_name?.replace(/\s+/g, '_') || 'Client'}_${format(new Date(contract.start_date), 'MMM_yyyy')}.pdf`;
  doc.save(fileName);
}
