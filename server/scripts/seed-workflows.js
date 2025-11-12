#!/usr/bin/env node
/**
 * Seed sample workflow templates for testing
 * Usage: node server/scripts/seed-workflows.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { WorkflowTemplate } = require('../models/Workflow');

const workflowTemplates = [
  {
    name: 'Standard Screen Replacement',
    description: 'Complete workflow for replacing a device screen with quality checks',
    deviceTypes: ['Smartphone', 'Tablet'],
    serviceTypes: ['Display'],
    isActive: true,
    steps: [
      {
        name: 'Initial Device Inspection',
        description: 'Check the device condition and document any existing damage',
        estimatedTime: 15,
        isRequired: true,
        order: 1,
        category: 'diagnostic',
        dependencies: [],
        tools: ['Inspection lamp', 'Camera'],
        skills: ['Visual inspection', 'Documentation'],
        checklistItems: [
          'Check for water damage indicators',
          'Document all existing scratches and dents',
          'Test touch functionality (if possible)',
          'Take photos of device condition'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [],
        position: { x: 0, y: 0 },
        canSkip: false,
        requiresApproval: false,
        notificationSettings: {
          onStart: true,
          onComplete: false,
          onDelay: false
        }
      },
      {
        name: 'Remove Old Screen',
        description: 'Carefully remove the damaged screen from the device',
        estimatedTime: 30,
        isRequired: true,
        order: 2,
        category: 'repair',
        dependencies: [],
        tools: ['Heat gun', 'Suction cup', 'Prying tools', 'Screwdrivers'],
        skills: ['Screen removal', 'Heat application', 'Precision work'],
        checklistItems: [
          'Apply heat to loosen adhesive',
          'Use suction cup to lift screen',
          'Carefully disconnect flex cables',
          'Remove all adhesive residue'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [],
        position: { x: 0, y: 100 },
        canSkip: false,
        requiresApproval: false,
        notificationSettings: {
          onStart: false,
          onComplete: false,
          onDelay: true
        }
      },
      {
        name: 'Install New Screen',
        description: 'Install the replacement screen and connect all cables',
        estimatedTime: 25,
        isRequired: true,
        order: 3,
        category: 'repair',
        dependencies: [],
        tools: ['New screen', 'Adhesive strips', 'Screwdrivers'],
        skills: ['Screen installation', 'Cable connection'],
        checklistItems: [
          'Clean device frame thoroughly',
          'Connect flex cables properly',
          'Apply new adhesive strips',
          'Secure screen in place'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [],
        position: { x: 0, y: 200 },
        canSkip: false,
        requiresApproval: false,
        notificationSettings: {
          onStart: false,
          onComplete: false,
          onDelay: false
        }
      },
      {
        name: 'Quality Testing',
        description: 'Test all device functions to ensure proper repair',
        estimatedTime: 20,
        isRequired: true,
        order: 4,
        category: 'quality',
        dependencies: [],
        tools: ['Testing software', 'Multimeter'],
        skills: ['Quality testing', 'Function testing'],
        checklistItems: [
          'Test touch responsiveness across entire screen',
          'Check display colors and brightness',
          'Test all buttons and ports',
          'Verify face ID / fingerprint sensor',
          'Check camera and speaker functionality'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [],
        position: { x: 0, y: 300 },
        canSkip: false,
        requiresApproval: true,
        notificationSettings: {
          onStart: false,
          onComplete: true,
          onDelay: false
        }
      },
      {
        name: 'Final Inspection & Cleanup',
        description: 'Clean device and perform final quality check',
        estimatedTime: 10,
        isRequired: true,
        order: 5,
        category: 'completion',
        dependencies: [],
        tools: ['Microfiber cloth', 'Screen cleaner', 'Camera'],
        skills: ['Cleaning', 'Final inspection'],
        checklistItems: [
          'Clean screen and device body',
          'Remove any fingerprints or smudges',
          'Take after-repair photos',
          'Package device securely'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [
          {
            trigger: 'step_completion',
            action: 'update_status',
            actionData: { orderStatus: 'ready-for-pickup' },
            isActive: true
          }
        ],
        position: { x: 0, y: 400 },
        canSkip: false,
        requiresApproval: false,
        notificationSettings: {
          onStart: false,
          onComplete: true,
          onDelay: false
        }
      }
    ],
    estimatedTotalTime: 100,
    globalAutomationRules: [],
    workflowSettings: {
      allowParallelSteps: false,
      requireStrictOrder: true,
      autoProgressOnCompletion: true
    }
  },
  {
    name: 'Battery Replacement',
    description: 'Safe battery replacement procedure with testing',
    deviceTypes: ['Smartphone', 'Tablet', 'Laptop'],
    serviceTypes: ['Power'],
    isActive: true,
    steps: [
      {
        name: 'Battery Diagnostic',
        description: 'Test current battery health and document findings',
        estimatedTime: 10,
        isRequired: true,
        order: 1,
        category: 'diagnostic',
        dependencies: [],
        tools: ['Battery tester', 'Diagnostic software'],
        skills: ['Battery testing', 'Diagnostic tools'],
        checklistItems: [
          'Run battery health diagnostic',
          'Document current battery capacity',
          'Check for swelling or damage',
          'Note charging behavior'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [],
        position: { x: 0, y: 0 },
        canSkip: false,
        requiresApproval: false,
        notificationSettings: {
          onStart: true,
          onComplete: false,
          onDelay: false
        }
      },
      {
        name: 'Remove Old Battery',
        description: 'Safely remove the old battery following safety protocols',
        estimatedTime: 20,
        isRequired: true,
        order: 2,
        category: 'repair',
        dependencies: [],
        tools: ['Screwdrivers', 'Prying tools', 'Heat gun', 'Safety gloves'],
        skills: ['Battery removal', 'Safety protocols'],
        checklistItems: [
          'Power off device completely',
          'Disconnect battery connector first',
          'Apply heat carefully if adhesive present',
          'Remove battery safely',
          'Dispose of old battery properly'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [],
        position: { x: 0, y: 100 },
        canSkip: false,
        requiresApproval: false,
        notificationSettings: {
          onStart: false,
          onComplete: false,
          onDelay: true
        }
      },
      {
        name: 'Install New Battery',
        description: 'Install and secure the new battery',
        estimatedTime: 15,
        isRequired: true,
        order: 3,
        category: 'repair',
        dependencies: [],
        tools: ['New battery', 'Adhesive strips', 'Screwdrivers'],
        skills: ['Battery installation'],
        checklistItems: [
          'Verify battery compatibility',
          'Clean battery compartment',
          'Place new battery correctly',
          'Connect battery securely',
          'Apply adhesive if required'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [],
        position: { x: 0, y: 200 },
        canSkip: false,
        requiresApproval: false,
        notificationSettings: {
          onStart: false,
          onComplete: false,
          onDelay: false
        }
      },
      {
        name: 'Battery Testing & Calibration',
        description: 'Test new battery and calibrate if needed',
        estimatedTime: 25,
        isRequired: true,
        order: 4,
        category: 'quality',
        dependencies: [],
        tools: ['Charger', 'Battery tester', 'Diagnostic software'],
        skills: ['Battery testing', 'Calibration'],
        checklistItems: [
          'Test charging functionality',
          'Verify battery is detected properly',
          'Check charging speed',
          'Run full charge-discharge cycle if time permits',
          'Verify battery health shows 100%'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [],
        position: { x: 0, y: 300 },
        canSkip: false,
        requiresApproval: true,
        notificationSettings: {
          onStart: false,
          onComplete: true,
          onDelay: false
        }
      }
    ],
    estimatedTotalTime: 70,
    globalAutomationRules: [],
    workflowSettings: {
      allowParallelSteps: false,
      requireStrictOrder: true,
      autoProgressOnCompletion: true
    }
  },
  {
    name: 'Camera Repair',
    description: 'Complete workflow for repairing device cameras',
    deviceTypes: ['Smartphone', 'Tablet', 'Laptop'],
    serviceTypes: ['Camera'],
    isActive: true,
    steps: [
      {
        name: 'Camera Diagnostic',
        description: 'Test camera functionality and identify issues',
        estimatedTime: 10,
        isRequired: true,
        order: 1,
        category: 'diagnostic',
        dependencies: [],
        tools: ['Camera app', 'Diagnostic software'],
        skills: ['Camera testing'],
        checklistItems: [
          'Test front camera',
          'Test rear camera',
          'Check autofocus',
          'Test flash',
          'Document any errors'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [],
        position: { x: 0, y: 0 },
        canSkip: false,
        requiresApproval: false,
        notificationSettings: {
          onStart: true,
          onComplete: false,
          onDelay: false
        }
      },
      {
        name: 'Camera Replacement',
        description: 'Replace faulty camera module',
        estimatedTime: 30,
        isRequired: true,
        order: 2,
        category: 'repair',
        dependencies: [],
        tools: ['Screwdrivers', 'Prying tools', 'Camera module'],
        skills: ['Component replacement'],
        checklistItems: [
          'Remove protective cover',
          'Disconnect camera flex',
          'Remove faulty camera',
          'Install new camera',
          'Verify alignment'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [],
        position: { x: 0, y: 100 },
        canSkip: false,
        requiresApproval: false,
        notificationSettings: {
          onStart: false,
          onComplete: false,
          onDelay: false
        }
      },
      {
        name: 'Camera Testing',
        description: 'Test camera functionality after repair',
        estimatedTime: 15,
        isRequired: true,
        order: 3,
        category: 'quality',
        dependencies: [],
        tools: ['Camera app', 'Diagnostic software'],
        skills: ['Camera testing'],
        checklistItems: [
          'Test photo quality',
          'Test video recording',
          'Test autofocus',
          'Test flash',
          'Check for artifacts'
        ],
        formFields: [],
        requiresFormCompletion: false,
        automationRules: [],
        position: { x: 0, y: 200 },
        canSkip: false,
        requiresApproval: true,
        notificationSettings: {
          onStart: false,
          onComplete: true,
          onDelay: false
        }
      }
    ],
    estimatedTotalTime: 55,
    globalAutomationRules: [],
    workflowSettings: {
      allowParallelSteps: false,
      requireStrictOrder: true,
      autoProgressOnCompletion: true
    }
  }
];

async function seedWorkflows() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('Connected to MongoDB successfully');

    console.log('\nClearing existing workflow templates...');
    await WorkflowTemplate.deleteMany({});
    console.log('Cleared existing workflow templates');

    console.log('\nSeeding workflow templates...');
    for (const workflowData of workflowTemplates) {
      const workflow = new WorkflowTemplate(workflowData);
      await workflow.save();
      console.log(`✓ Created workflow: ${workflow.name} (${workflow.steps.length} steps)`);
    }

    console.log(`\n✅ Successfully seeded ${workflowTemplates.length} workflow templates`);
    console.log('\nWorkflow templates created:');
    workflowTemplates.forEach((wf, index) => {
      console.log(`${index + 1}. ${wf.name}`);
      console.log(`   - Device Types: ${wf.deviceTypes.join(', ')}`);
      console.log(`   - Service Types: ${wf.serviceTypes.join(', ')}`);
      console.log(`   - Steps: ${wf.steps.length}`);
      console.log(`   - Estimated Time: ${wf.estimatedTotalTime} minutes`);
    });

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding workflows:', error);
    process.exit(1);
  }
}

// Run the seed function
seedWorkflows();
