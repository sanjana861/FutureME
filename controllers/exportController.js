const { getDb } = require('../config/db');
const PDFDocument = require('pdfkit');

// Helper: Fetch all dashboard data for export
async function getExportData(userId) {
  const db = await getDb();

  const profile = await db.get('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  if (!profile) return null;

  const roadmapRow = await db.get('SELECT roadmap_json FROM roadmaps WHERE user_id = ?', [userId]);
  const roadmap = roadmapRow ? JSON.parse(roadmapRow.roadmap_json) : null;

  const projects = await db.all('SELECT * FROM projects WHERE user_id = ?', [userId]);
  const formattedProjects = projects.map(p => ({
    ...p,
    features: JSON.parse(p.features || '[]'),
    resume_bullet_points: JSON.parse(p.resume_bullet_points || '[]')
  }));

  const skills = await db.all('SELECT skill_name, proficiency_percentage FROM skill_progress WHERE user_id = ?', [userId]);

  const weeklyPlanRow = await db.get('SELECT plan_json FROM weekly_plans WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  const weeklyPlan = weeklyPlanRow ? JSON.parse(weeklyPlanRow.plan_json) : null;

  const brandingRow = await db.get("SELECT data_json FROM reports WHERE user_id = ? AND report_type = 'branding_audit' ORDER BY id DESC LIMIT 1", [userId]);
  const branding = brandingRow ? JSON.parse(brandingRow.data_json) : null;

  return { profile, roadmap, projects: formattedProjects, skills, weeklyPlan, branding };
}

// EXPORT AS JSON
async function exportJson(req, res) {
  const userId = req.user.id;
  try {
    const data = await getExportData(userId);
    if (!data) {
      return res.status(404).json({ error: 'No profile data found to export.' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=futureme_roadmap_${userId}.json`);
    return res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Export JSON error:', error);
    return res.status(500).json({ error: 'Failed to compile JSON export.' });
  }
}

// EXPORT AS MARKDOWN
async function exportMarkdown(req, res) {
  const userId = req.user.id;
  try {
    const data = await getExportData(userId);
    if (!data) {
      return res.status(404).json({ error: 'No profile data found to export.' });
    }

    const { profile, roadmap, projects, skills, weeklyPlan, branding } = data;

    let md = `# FutureMe OS Career Roadmap Report\n`;
    md += `Generated on: ${new Date().toLocaleDateString()}\n\n`;

    md += `## 1. Personal Profile\n`;
    md += `- **Full Name**: ${profile.full_name}\n`;
    md += `- **Target Role**: ${profile.dream_role}\n`;
    md += `- **Dream Company**: ${profile.dream_company}\n`;
    md += `- **Expected Salary**: ${profile.expected_salary || 'Market Rate'}\n`;
    md += `- **Learning Time Commitment**: ${profile.learning_time} per day\n`;
    md += `- **Learning Style**: ${profile.learning_style || 'Not Set'}\n\n`;
    
    md += `### Career Summary\n`;
    md += `${profile.career_summary || 'No summary generated.'}\n\n`;

    md += `## 2. Capability Telemetry (Skills Progress)\n`;
    if (skills && skills.length > 0) {
      skills.forEach(s => {
        md += `- **${s.skill_name}**: ${s.proficiency_percentage}%\n`;
      });
    } else {
      md += `No skills configured.\n`;
    }
    md += `\n`;

    md += `## 3. Sequential Career Roadmap Phases\n`;
    if (roadmap && roadmap.phases) {
      roadmap.phases.forEach(p => {
        md += `### Phase ${p.phase_number}: ${p.title}\n`;
        md += `- **Description**: ${p.description}\n`;
        md += `- **Target Completion**: ${p.estimated_date || 'TBD'}\n`;
        md += `- **Milestones**:\n`;
        if (p.milestones) {
          p.milestones.forEach(m => md += `  - [ ] ${m}\n`);
        }
        md += `\n`;
      });
    } else {
      md += `No roadmap active.\n\n`;
    }

    md += `## 4. Flagship Portfolio Applications\n`;
    if (projects && projects.length > 0) {
      projects.forEach(p => {
        md += `### ${p.title} (${p.difficulty} Build)\n`;
        md += `- **Problem Statement**: ${p.problem}\n`;
        md += `- **Suggested Tech Stack**: ${p.tech_stack}\n`;
        md += `- **Timeline**: ${p.timeline}\n`;
        md += `- **Features**:\n`;
        if (Array.isArray(p.features)) {
          p.features.forEach(f => md += `  - ${f}\n`);
        }
        md += `- **Suggested Folder Structure**:\n\`\`\`\n${p.folder_structure}\n\`\`\`\n`;
        md += `- **Suggested Resume Wording**:\n`;
        if (Array.isArray(p.resume_bullet_points)) {
          p.resume_bullet_points.forEach(b => md += `  - *${b}*\n`);
        }
        md += `\n`;
      });
    } else {
      md += `No project specifications built.\n\n`;
    }

    md += `## 5. Professional Branding & Placement Tips\n`;
    if (branding) {
      md += `### Recruiter-Optimized LinkedIn Headline\n`;
      md += `> "${branding.linkedin_headline}"\n\n`;

      md += `### LinkedIn 'About' Biography Summary\n`;
      md += `${branding.linkedin_about}\n\n`;

      md += `### ATS Resume Improvements\n`;
      if (branding.resume_improvements) {
        branding.resume_improvements.forEach(item => {
          md += `- **Current**: "${item.current_wording}"\n`;
          md += `  - **Replace With**: *"${item.suggested_wording}"*\n`;
          md += `  - **Reason**: ${item.impact_reason}\n\n`;
        });
      }
    }

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename=futureme_roadmap_${userId}.md`);
    return res.send(md);
  } catch (error) {
    console.error('Export Markdown error:', error);
    return res.status(500).json({ error: 'Failed to compile Markdown export.' });
  }
}

// EXPORT AS PDF
async function exportPdf(req, res) {
  const userId = req.user.id;
  try {
    const data = await getExportData(userId);
    if (!data) {
      return res.status(404).json({ error: 'No profile data found to export.' });
    }

    const { profile, roadmap, projects, skills, branding } = data;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=futureme_roadmap_${userId}.pdf`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Document Title
    doc.fontSize(24).font('Helvetica-Bold').text('FutureMe OS — AI Career Roadmap', { align: 'center' });
    doc.moveDown();
    
    // Metadata block
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Profile Details
    doc.fontSize(16).font('Helvetica-Bold').text('1. Personal Profile');
    doc.lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(12).font('Helvetica-Bold').text('Name: ', { continued: true }).font('Helvetica').text(profile.full_name);
    doc.fontSize(12).font('Helvetica-Bold').text('Target Goal: ', { continued: true }).font('Helvetica').text(`${profile.dream_role} @ ${profile.dream_company}`);
    doc.fontSize(12).font('Helvetica-Bold').text('Expected Salary: ', { continued: true }).font('Helvetica').text(profile.expected_salary || 'Market Rate');
    doc.fontSize(12).font('Helvetica-Bold').text('Time Budget: ', { continued: true }).font('Helvetica').text(`${profile.learning_time} per day`);
    doc.moveDown();

    doc.font('Helvetica-Oblique').fontSize(11).text(profile.career_summary || '', { align: 'justify' });
    doc.moveDown(2);

    // Skills Telemetry
    doc.fontSize(16).font('Helvetica-Bold').text('2. Capability Telemetry');
    doc.lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    if (skills && skills.length > 0) {
      skills.forEach(s => {
        doc.fontSize(12).font('Helvetica-Bold').text(`${s.skill_name}: `, { continued: true }).font('Helvetica').text(`${s.proficiency_percentage}% proficiency`);
      });
    } else {
      doc.fontSize(11).text('No skills defined.');
    }
    doc.moveDown(2);

    // Roadmap Phases
    doc.fontSize(16).font('Helvetica-Bold').text('3. Sequential Roadmap Phases');
    doc.lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    if (roadmap && roadmap.phases) {
      roadmap.phases.forEach(p => {
        doc.fontSize(13).font('Helvetica-Bold').text(`Phase ${p.phase_number}: ${p.title}`);
        doc.fontSize(11).font('Helvetica').text(`Target Date: ${p.estimated_date || 'TBD'}`);
        doc.font('Helvetica-Oblique').text(p.description);
        
        doc.font('Helvetica').text('Milestones:');
        if (p.milestones) {
          p.milestones.forEach(m => {
            doc.text(`- ${m}`, { indent: 15 });
          });
        }
        doc.moveDown();
      });
    }
    
    // Add page for projects
    doc.addPage();

    doc.fontSize(16).font('Helvetica-Bold').text('4. Flagship Portfolio Applications');
    doc.lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    if (projects && projects.length > 0) {
      projects.forEach(p => {
        doc.fontSize(13).font('Helvetica-Bold').text(`${p.title} (${p.difficulty} Build)`);
        doc.fontSize(11).font('Helvetica').text(`Tech Stack: ${p.tech_stack} | Timeline: ${p.timeline}`);
        doc.font('Helvetica-Oblique').text(`Challenge: ${p.problem}`);
        doc.moveDown();
      });
    } else {
      doc.fontSize(11).text('No portfolio projects configured.');
    }

    // Add page for branding
    if (branding) {
      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').text('5. Professional Branding');
      doc.lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      doc.fontSize(12).font('Helvetica-Bold').text('LinkedIn Headline:');
      doc.font('Helvetica-Oblique').text(`"${branding.linkedin_headline}"`);
      doc.moveDown();

      doc.font('Helvetica-Bold').text('LinkedIn About Profile:');
      doc.font('Helvetica').text(branding.linkedin_about, { align: 'justify' });
      doc.moveDown();

      doc.font('Helvetica-Bold').text('ATS Resume Auditing:');
      if (branding.resume_improvements) {
        branding.resume_improvements.forEach(item => {
          doc.font('Helvetica').text(`Replace: "${item.current_wording}"`);
          doc.font('Helvetica-Bold').text(`With: "${item.suggested_wording}"`);
          doc.font('Helvetica-Oblique').text(`Reason: ${item.impact_reason}`);
          doc.moveDown(0.5);
        });
      }
    }

    doc.end();
  } catch (error) {
    console.error('Export PDF error:', error);
    // Don't crash response if writing started, but try to reply
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to compile PDF report export.' });
    }
  }
}

module.exports = {
  exportJson,
  exportMarkdown,
  exportPdf
};
