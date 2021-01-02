const core = require('@actions/core');
const fs = require('fs');

function VersionPart(part) {
   var self = this;
   var m_prefix = '';
   var m_suffix = '';
   var m_number = 0;

   self.setNumber = function(number) {
      if (!isNaN(number)) {
         m_number = number;
      }
   }

   self.getNumber = function() {
      return m_number;
   }

   self.getSuffix = function(){
       return m_suffix;
   }

   self.toString = function() {
      return m_prefix + m_number.toString() + m_suffix;
   }

   self.next = function() {
      m_number += 1;
   }

   function parsePartPrefix(part) {
      if (isNaN(part[0])) {
         for (var i = 0; i < part.length; ++i) {
            if (!isNaN(part[i])) {
               break;
            }
            m_prefix += part[i];
         }
      }
   }

   function parsePartNumber(part) {
      let number = 0;

      if (m_prefix.length > 0){
         number = parseInt(part.substring(m_prefix.length));
      }
      else{
         number = parseInt(part);
      }

      self.setNumber(number);
   }

   function parsePartSuffix(part) {
      let items = part.split('-');
      if (items.length == 2) {
         m_suffix = '-' + items[1];
      }
   }

   self.setPart = function(part) {
      if (part && part.length > 0){
         parsePartPrefix(part);
         parsePartNumber(part);
         parsePartSuffix(part);
      }
   }

   self.setPart(part);
}

function Version(version) {
   const PARTS_DELIMITER = '.';
   var m_major = new VersionPart();
   var m_minor = new VersionPart();
   var m_patch = new VersionPart();
   var m_build = new VersionPart();

   this.toString = function() {
      return ( m_major.toString() + PARTS_DELIMITER +
               m_minor.toString() + PARTS_DELIMITER +
               m_patch.toString() + PARTS_DELIMITER +
               m_build.toString());
   }

   this.nextBuild = function() {
      m_build.next();
   }

   function init() {
      let versionParts = version.split(PARTS_DELIMITER);

      if (versionParts.length == 3) {
         m_major.setPart(versionParts[0]);
         m_minor.setPart(versionParts[1]);
         m_build.setPart(versionParts[2]);
         m_patch.setNumber(m_build.getNumber());
         m_build.setNumber(0);
      }
      else if (versionParts.length == 4) {
         m_major.setPart(versionParts[0]);
         m_minor.setPart(versionParts[1]);
         m_patch.setPart(versionParts[2]);
         m_build.setPart(versionParts[3]);
      }
      else {
         core.setFailed('ERROR: previous-build contains wrong version number <' + version + '>');
      }
   }

   this.getMajor = function() {
      return m_major.getNumber();
   }

   this.getMinor = function() {
      return m_minor.getNumber();
   }

   this.getPatch = function() {
      return m_patch.getNumber();
   }

   this.getStage = function(){
       return m_build.getSuffix();
   }

   this.isSamePatch = function(version) {
      return (this.getMajor() == version.getMajor() &&
              this.getMinor() == version.getMinor() &&
              this.getPatch() == version.getPatch() &&
              this.getStage() == version.getStage());
   }

   init();
}

function getOptionValue(source, option) {
   let start = source.indexOf(option);
   if (start != -1) {
      start += option.length + 1;
      let end = source.indexOf(')', start);
      return source.toString('utf8', start, end).replace(/\"/g, '').trim();
   }
   else{
      core.setFailed("ERROR: Can't find option <" + option + ">");
   }
}

function getVersionFromFile(){
      let options = fs.readFileSync('cmake/Version.cmake');
      let major = getOptionValue(options, 'SYNERGY_VERSION_MAJOR');
      let minor = getOptionValue(options, 'SYNERGY_VERSION_MINOR');
      let patch = getOptionValue(options, 'SYNERGY_VERSION_PATCH');
      let stage = getOptionValue(options, 'SYNERGY_VERSION_STAGE');

      return (major + '.' + minor + '.' + patch + '-' + stage);
}

try {
   let version = null;
   let gitVersion = new Version(core.getInput('previous-build'));
   let cmakeVersion = new Version(getVersionFromFile());

   console.log('INFO: Version from Git: <' + gitVersion.toString() + '>');
   console.log('INFO: Version from cmake: <' + cmakeVersion.toString() + '>');

   if (cmakeVersion.isSamePatch(gitVersion)) {
      gitVersion.nextBuild();
      version = gitVersion;
   }
   else {
      version = cmakeVersion;
   }

   console.log('INFO: Generate build version: <' + version.toString() + '>');
   core.setOutput('next-build', version.toString());

  } catch (error) {
    core.setFailed(error.message);
  }