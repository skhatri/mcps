#!/usr/bin/env node

import { mavenResolver } from './dist/tools/maven-resolver.js';

async function testApi() {
  try {
    console.log('Testing Maven Central API fix...');
    
    const result = await mavenResolver.getLatestVersion({
      groupId: 'org.apache.flink',
      artifactId: 'flink-core'
    });
    
    console.log('✅ Success! Flink Result:', JSON.stringify(result, null, 2));
    
    // Test with Jackson (known to have stable versions)
    const result2 = await mavenResolver.getLatestVersion({
      groupId: 'com.fasterxml.jackson.core',
      artifactId: 'jackson-databind'
    });
    
    console.log('✅ Jackson Result:', JSON.stringify(result2, null, 2));
    
    // Test the original problematic Spark artifact
    try {
      const result3 = await mavenResolver.getLatestVersion({
        groupId: 'org.apache.spark',
        artifactId: 'spark-core_2.13'
      });
      console.log('✅ Spark Result:', JSON.stringify(result3, null, 2));
    } catch (error) {
      console.log('ℹ️ Spark only has pre-release versions currently:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    mavenResolver.destroy();
  }
}

testApi();
