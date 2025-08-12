#!/usr/bin/env node

import { mavenResolver } from './dist/tools/maven-resolver.js';

async function testApi() {
  try {
    console.log('Testing Maven Central API fix...');
    
    const result = await mavenResolver.getLatestVersion({
      groupId: 'org.apache.spark',
      artifactId: 'spark-core_2.13'
    });
    
    console.log('✅ Success! Result:', JSON.stringify(result, null, 2));
    
    // Test with another artifact
    const result2 = await mavenResolver.getLatestVersion({
      groupId: 'org.springframework',
      artifactId: 'spring-core'
    });
    
    console.log('✅ Spring Core Result:', JSON.stringify(result2, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    mavenResolver.destroy();
  }
}

testApi();
