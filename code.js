// This is the main plugin code (code.js)
// Figma plugin to swap component instances while preserving appearance property

figma.showUI(__html__, { width: 400, height: 650 });

// Helper function to normalize component names for matching
function normalizeName(name) {
  return name.trim().toLowerCase();
}

// Helper function to check if component name matches (case-insensitive, allows partial match)
function nameMatches(componentName, searchName) {
  const normalized = normalizeName(componentName);
  const normalizedSearch = normalizeName(searchName);
  return normalized === normalizedSearch || normalized.includes(normalizedSearch) || normalizedSearch.includes(normalized);
}

// Function to find a component that matches properties but is different from the current one
function findComponentByProperties(instance, excludeComponentId) {
  const instanceProps = getAllComponentProperties(instance);
  const propKeys = Object.keys(instanceProps);
  
  if (propKeys.length === 0) {
    return null;
  }
  
  // Get all components
  const allComponents = findAllComponentsInAllPages();
  
  // Look for components that have similar property structure
  for (const comp of allComponents) {
    if (comp.id === excludeComponentId) {
      continue; // Skip the current component
    }
    
    // Check if this component has similar properties
    // We'll check by trying to create an instance and see if it has compatible properties
    try {
      const testInstance = comp.createInstance();
      if (testInstance.componentProperties) {
        const testProps = Object.keys(testInstance.componentProperties);
        
        // Check if property names match (case-insensitive)
        const matchingProps = testProps.filter(testKey => {
          const lowerTestKey = testKey.toLowerCase();
          return propKeys.some(propKey => {
            const lowerPropKey = propKey.toLowerCase();
            return lowerTestKey === lowerPropKey || 
                   (lowerTestKey.includes('appearance') && lowerPropKey.includes('appearance')) ||
                   (lowerTestKey.includes('state') && lowerPropKey.includes('state'));
          });
        });
        
        // If we have matching properties, this might be the target component
        if (matchingProps.length > 0 && matchingProps.length >= propKeys.length * 0.5) {
          testInstance.remove(); // Clean up test instance
          return comp;
        }
      }
      testInstance.remove(); // Clean up test instance
    } catch (e) {
      // Component might not be instantiable, skip
    }
  }
  
  return null;
}

// Component names to search for
const OLD_COMPONENT_NAME = "❖ Lozenge (Prod)";
const NEW_COMPONENT_NAME = "Lozenge (EAP)";

// Store component references
let oldComponent = null;
let newComponent = null;

// Function to find all components on the current page
function findAllComponentsOnCurrentPage() {
  const components = [];
  const currentPage = figma.currentPage;
  
  function traverse(node) {
    // Check if it's a component
    if (node.type === 'COMPONENT') {
      components.push(node);
    }
    
    // Also check component sets (variants)
    if (node.type === 'COMPONENT_SET') {
      // Component sets contain components as children
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'COMPONENT') {
            components.push(child);
          }
        }
      }
    }
    
    // Traverse children
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  // Search only current page
  traverse(currentPage);
  
  return components;
}

// Function to find all components in all pages (fallback)
function findAllComponentsInAllPages() {
  const components = [];
  
  function traverse(node) {
    if (node.type === 'COMPONENT') {
      components.push(node);
    }
    
    if (node.type === 'COMPONENT_SET') {
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'COMPONENT') {
            components.push(child);
          }
        }
      }
    }
    
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  // Search all pages
  for (const page of figma.root.children) {
    traverse(page);
  }
  
  return components;
}

// Search for components by name
function findComponentsByName() {
  // First try current page
  let allComponents = findAllComponentsOnCurrentPage();
  
  // If not found, search all pages
  if (!oldComponent || !newComponent) {
    const currentPageComponents = allComponents.length;
    allComponents = findAllComponentsInAllPages();
    console.log(`Found ${currentPageComponents} components on current page, ${allComponents.length} total`);
  }
  
  // Find old component (case-insensitive, partial match)
  if (!oldComponent) {
    for (const comp of allComponents) {
      if (nameMatches(comp.name, OLD_COMPONENT_NAME)) {
        oldComponent = comp;
        console.log(`Found old component: ${comp.name} (ID: ${comp.id})`);
        break;
      }
    }
  }
  
  // Find new component (case-insensitive, partial match)
  if (!newComponent) {
    for (const comp of allComponents) {
      if (nameMatches(comp.name, NEW_COMPONENT_NAME)) {
        newComponent = comp;
        console.log(`Found new component: ${comp.name} (ID: ${comp.id})`);
        break;
      }
    }
  }
  
  return { oldFound: !!oldComponent, newFound: !!newComponent };
}


// Scan for instances when components are ready
async function scanInstances() {
  if (!oldComponent) {
    return;
  }
  
  const instances = findAllInstances(oldComponent);
  console.log(`Found ${instances.length} instances of "${oldComponent.name}" on current page`);
  console.log(`Component ID: ${oldComponent.id}`);
  
  // Debug: log first few instances to see what we're matching
  if (instances.length > 0) {
    const firstInstance = instances[0];
    const mainComponentId = firstInstance.mainComponent ? firstInstance.mainComponent.id : 'null';
    console.log(`First instance mainComponent ID: ${mainComponentId}`);
    console.log(`Component match: ${mainComponentId === oldComponent.id}`);
  }
  
  figma.ui.postMessage({
    type: 'instances-found',
    count: instances.length,
    oldName: oldComponent.name
  });
  
  // If no instances found, send debug info
  if (instances.length === 0) {
    figma.ui.postMessage({
      type: 'info',
      message: `No instances found. Component ID: ${oldComponent.id}. Try selecting an instance manually to verify.`
    });
  }
}

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'set-old-component') {
    const selection = figma.currentPage.selection;
    if (selection.length === 1) {
      const selected = selection[0];
      if (selected.type === 'COMPONENT') {
        oldComponent = selected;
        figma.ui.postMessage({
          type: 'old-component-set',
          name: oldComponent.name,
          id: oldComponent.id
        });
        
        // Try to auto-detect new component based on properties
        if (oldComponent && !newComponent) {
          // Look for an instance to analyze
          const instances = findAllInstances(oldComponent);
          if (instances.length > 0) {
            const detectedComponent = findComponentByProperties(instances[0], oldComponent.id);
            if (detectedComponent) {
              newComponent = detectedComponent;
              figma.ui.postMessage({
                type: 'new-component-auto-detected',
                name: newComponent.name,
                id: newComponent.id
              });
            }
          }
        }
        
        checkComponentsReady();
      } else if (selected.type === 'INSTANCE' && selected.mainComponent) {
        // Allow selecting an instance to set the old component
        oldComponent = selected.mainComponent;
        figma.ui.postMessage({
          type: 'old-component-set',
          name: oldComponent.name,
          id: oldComponent.id
        });
        
        // Try to auto-detect new component based on instance properties
        const detectedComponent = findComponentByProperties(selected, oldComponent.id);
        if (detectedComponent) {
          newComponent = detectedComponent;
          figma.ui.postMessage({
            type: 'new-component-auto-detected',
            name: newComponent.name,
            id: newComponent.id
          });
        }
        
        checkComponentsReady();
      } else {
        figma.ui.postMessage({
          type: 'error',
          message: 'Please select a component or instance'
        });
      }
    } else {
      figma.ui.postMessage({
        type: 'error',
        message: 'Please select a single component or instance'
      });
    }
  }

  if (msg.type === 'set-new-component') {
    const selection = figma.currentPage.selection;
    if (selection.length === 1 && selection[0].type === 'COMPONENT') {
      newComponent = selection[0];
      figma.ui.postMessage({
        type: 'new-component-set',
        name: newComponent.name,
        id: newComponent.id
      });
      checkComponentsReady();
    } else {
      figma.ui.postMessage({
        type: 'error',
        message: 'Please select a single component'
      });
    }
  }

  if (msg.type === 'scan-instances') {
    await scanInstances();
  }

  if (msg.type === 'check-ready') {
    checkComponentsReady();
  }

  if (msg.type === 'swap-all') {
    if (!oldComponent) {
      figma.ui.postMessage({
        type: 'error',
        message: 'Please set the old component'
      });
      return;
    }
    
    // If new component not set, try to auto-detect from first instance
    if (!newComponent) {
      const instances = findAllInstances(oldComponent);
      if (instances.length > 0) {
        newComponent = findComponentByProperties(instances[0], oldComponent.id);
        if (newComponent) {
          figma.ui.postMessage({
            type: 'new-component-auto-detected',
            name: newComponent.name,
            id: newComponent.id
          });
        }
      }
      
      if (!newComponent) {
        figma.ui.postMessage({
          type: 'error',
          message: 'Could not auto-detect new component. Please set it manually.'
        });
        return;
      }
    }

    try {
      const result = await swapAllInstances(oldComponent, newComponent);
      figma.ui.postMessage({
        type: 'swap-complete',
        total: result.total,
        swapped: result.swapped,
        preserved: result.preserved,
        failed: result.failed
      });
    } catch (error) {
      figma.ui.postMessage({
        type: 'error',
        message: error.message
      });
    }
  }

  if (msg.type === 'cancel') {
    figma.closePlugin();
  }
};

function checkComponentsReady() {
  if (oldComponent) {
    // Always try to auto-detect new component if not set
    if (!newComponent) {
      const instances = findAllInstances(oldComponent);
      if (instances.length > 0) {
        const detectedComponent = findComponentByProperties(instances[0], oldComponent.id);
        if (detectedComponent) {
          newComponent = detectedComponent;
          figma.ui.postMessage({
            type: 'new-component-auto-detected',
            name: newComponent.name,
            id: newComponent.id
          });
        }
      }
    }
    
    // If we have both components, show ready state
    if (oldComponent && newComponent) {
      figma.ui.postMessage({
        type: 'components-ready',
        oldName: oldComponent.name,
        newName: newComponent.name
      });
      // Scan for instances after components are ready
      scanInstances();
    } else if (oldComponent) {
      // Only old component set, scan instances anyway
      scanInstances();
    }
  }
}

// Function to find all instances of a component on the current page
// This searches recursively through all nested layers, including inside component instances
function findAllInstances(component) {
  const instances = [];
  const currentPage = figma.currentPage;
  
  // Use findAll to search recursively through everything, including nested component instances
  try {
    const foundInstances = currentPage.findAll(node => {
      // Check if this is an instance of our target component
      if (node.type === 'INSTANCE' && node.mainComponent) {
        return node.mainComponent.id === component.id;
      }
      return false;
    });
    
    return foundInstances;
  } catch (error) {
    console.error('Error finding instances:', error);
    // Fallback to manual traversal
    function traverse(node) {
      if (node.type === 'INSTANCE' && node.mainComponent && node.mainComponent.id === component.id) {
        instances.push(node);
      }
      
      // Continue traversing even if this is a component instance
      // This allows us to find nested instances inside component instances
      if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }
    
    traverse(currentPage);
    return instances;
  }
}

// Function to get all component properties from an instance
function getAllComponentProperties(instance) {
  const properties = {};
  
  if (instance.componentProperties) {
    for (const key in instance.componentProperties) {
      const prop = instance.componentProperties[key];
      properties[key] = {
        value: prop.value,
        type: prop.type
      };
    }
  }
  
  return properties;
}

// Function to set component properties on an instance
function setComponentProperties(instance, properties) {
  if (!instance.componentProperties) return { set: 0, failed: 0 };
  
  let set = 0;
  let failed = 0;
  const propertiesToSet = {};
  
  // First, collect all properties that exist in the target component
  const targetProperties = {};
  if (instance.componentProperties) {
    for (const key in instance.componentProperties) {
      targetProperties[key] = instance.componentProperties[key];
    }
  }
  
  // Try to match properties from old instance to new instance
  for (const key in properties) {
    const prop = properties[key];
    
    // Check if the target component has this property
    if (targetProperties[key]) {
      try {
        // Try to set the same value
        propertiesToSet[key] = prop.value;
      } catch (e) {
        failed++;
      }
    } else {
      // Property doesn't exist in target, try to find by name matching
      const lowerKey = key.toLowerCase();
      for (const targetKey in targetProperties) {
        const lowerTargetKey = targetKey.toLowerCase();
        if (lowerKey === lowerTargetKey || 
            (lowerKey.includes('appearance') && lowerTargetKey.includes('appearance')) ||
            (lowerKey.includes('state') && lowerTargetKey.includes('state'))) {
          try {
            propertiesToSet[targetKey] = prop.value;
            break;
          } catch (e) {
            failed++;
          }
        }
      }
    }
  }
  
  // Set all properties at once
  if (Object.keys(propertiesToSet).length > 0) {
    try {
      instance.setProperties(propertiesToSet);
      set = Object.keys(propertiesToSet).length;
    } catch (e) {
      // If batch set fails, try setting individually
      for (const key in propertiesToSet) {
        try {
          instance.setProperties({ [key]: propertiesToSet[key] });
          set++;
        } catch (e) {
          failed++;
        }
      }
    }
  }
  
  return { set, failed };
}

// Swap a single instance while preserving all properties
async function swapSingleInstance(instance, oldComponent, newComponent) {
  // Get all component properties from the old instance
  const componentProperties = getAllComponentProperties(instance);
  
  // Store all visual properties
  const parent = instance.parent;
  const index = parent && parent.children ? 
    parent.children.indexOf(instance) : 0;
  
  const x = instance.x;
  const y = instance.y;
  const rotation = instance.rotation;
  const opacity = instance.opacity;
  const blendMode = instance.blendMode;
  const visible = instance.visible;
  const locked = instance.locked;
  const name = instance.name;
  
  // Store constraints if they exist
  const constraints = instance.constraints ? {
    horizontal: instance.constraints.horizontal,
    vertical: instance.constraints.vertical
  } : null;
  
  // Store effects if they exist
  const effects = instance.effects ? [...instance.effects] : [];
  
  // Store fills if they exist (for overrides)
  const fills = instance.fills && 'fills' in instance ? instance.fills : null;
  
  // Create new instance of target component
  const newInstance = newComponent.createInstance();
  
  // Copy all visual properties
  newInstance.x = x;
  newInstance.y = y;
  newInstance.rotation = rotation;
  newInstance.opacity = opacity;
  newInstance.blendMode = blendMode;
  newInstance.visible = visible;
  newInstance.locked = locked;
  newInstance.name = name;
  
  // Copy constraints
  if (constraints && newInstance.constraints) {
    newInstance.constraints = constraints;
  }
  
  // Copy effects
  if (effects.length > 0 && newInstance.effects) {
    try {
      newInstance.effects = effects;
    } catch (e) {
      // Effects might not be compatible
    }
  }
  
  // Copy fills if applicable
  if (fills && 'fills' in newInstance) {
    try {
      newInstance.fills = fills;
    } catch (e) {
      // Fills might not be compatible
    }
  }
  
  // Try to preserve component properties (appearance, state, etc.)
  const propertyResult = setComponentProperties(newInstance, componentProperties);
  
  // Insert at same position in parent
  if (parent && parent.insertChild) {
    parent.insertChild(index, newInstance);
  }
  
  // Remove old instance
  instance.remove();
  
  // Don't select individual instances during bulk swap
  // figma.currentPage.selection = [newInstance];
  // figma.viewport.scrollAndZoomIntoView([newInstance]);
  
  return {
    preserved: propertyResult.set,
    failed: propertyResult.failed
  };
}

// Swap all instances function
async function swapAllInstances(oldComp, newComp) {
  const instances = findAllInstances(oldComp);
  let swapped = 0;
  let preserved = 0;
  let failed = 0;

  // Process instances one by one to avoid race conditions
  for (const instance of instances) {
    try {
      const result = await swapSingleInstance(instance, oldComp, newComp);
      preserved += result.preserved;
      swapped++;
    } catch (error) {
      console.error('Failed to swap instance:', error);
      failed++;
    }
  }

  return {
    total: instances.length,
    swapped: swapped,
    preserved: preserved,
    failed: failed
  };
}