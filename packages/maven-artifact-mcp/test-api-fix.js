#!/usr/bin/env node

/**
 * Test script to verify Maven Central API fix
 * This tests the specific issue that was failing: Apache Flink artifact lookup
 * and several other popular Maven artifacts to ensure robustness
 */

import { mavenResolver } from './dist/tools/maven-resolver.js';

async function testArtifact(groupId, artifactId, description) {
    console.log(`\n=== Testing ${description} ===`);
    console.log(`Artifact: ${groupId}:${artifactId}`);
    
    try {
        const startTime = Date.now();
        const result = await mavenResolver.getLatestVersion({ groupId, artifactId });
        const duration = Date.now() - startTime;
        
        console.log('✅ SUCCESS');
        console.log(`📦 Latest Version: ${result.latestVersion}`);
        console.log(`📅 Last Updated: ${result.lastUpdated}`);
        console.log(`🏪 Repository: ${result.repository}`);
        console.log(`⚡ Duration: ${duration}ms`);
        console.log(`💾 From Cache: ${result.cached ? 'Yes' : 'No'}`);
        
        if (result.excludedVersions) {
            console.log(`🚫 Excluded Versions: ${result.excludedVersions.slice(0, 3).join(', ')}${result.excludedVersions.length > 3 ? '...' : ''}`);
        }
        
        return true;
    } catch (error) {
        console.log('❌ FAILED');
        console.log(`Error: ${error.message}`);
        return false;
    }
}

async function runTests() {
    console.log('🧪 Testing Maven Central API Fix');
    console.log('='.repeat(50));
    
    // Test artifacts - focusing on the original failing case and popular ones
    const testCases = [
        // Original failing case
        ['org.apache', 'flink', 'Apache Flink (Original failing case)'],
        
        // Popular Maven artifacts for robustness testing
        ['org.springframework', 'spring-core', 'Spring Framework Core'],
        ['com.google.guava', 'guava', 'Google Guava'],
        ['org.slf4j', 'slf4j-api', 'SLF4J API'],
        ['junit', 'junit', 'JUnit 4'],
        ['org.apache.commons', 'commons-lang3', 'Apache Commons Lang'],
        ['com.fasterxml.jackson.core', 'jackson-core', 'Jackson Core'],
        ['org.apache.maven', 'maven-core', 'Apache Maven Core']
    ];
    
    let successCount = 0;
    let totalCount = testCases.length;
    
    for (const [groupId, artifactId, description] of testCases) {
        const success = await testArtifact(groupId, artifactId, description);
        if (success) successCount++;
        
        // Small delay between tests to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 TEST RESULTS: ${successCount}/${totalCount} tests passed`);
    
    if (successCount === totalCount) {
        console.log('🎉 All tests passed! The Maven Central API fix is working correctly.');
    } else {
        console.log(`⚠️  ${totalCount - successCount} test(s) failed. Review the errors above.`);
    }
    
    // Test cache functionality by running the first test again
    console.log('\n=== Testing Cache Functionality ===');
    const cacheSuccess = await testArtifact('org.apache', 'flink', 'Apache Flink (Cache Test)');
    
    console.log('\n🧹 Cleaning up...');
    mavenResolver.destroy();
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
    console.error('\n❌ Unhandled promise rejection:', error);
    process.exit(1);
});

// Run the tests
runTests().catch(error => {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
});