var assert = require('assert'),
    fs = require('fs'),
    utils = require('./utils'),
    moment = require('moment'),
    should = require('should'),
    xmldom = require('xmldom'),
    xmlenc = require('xml-encryption'),
    saml = require('../lib/saml20');

describe('saml 2.0', function () {

  it('whole thing with default authnContextClassRef', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      issuer: 'urn:issuer',
      lifetimeInSeconds: 600,
      audiences: 'urn:myapp',
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar'
      },
      nameIdentifier:       'foo',
      nameIdentifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified'
    };

    var signedAssertion = saml.create(options);
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    
    var nameIdentifier = utils.getNameID(signedAssertion);
    assert.equal('foo', nameIdentifier.textContent);
    assert.equal('urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified', nameIdentifier.getAttribute('Format'));

    var attributes = utils.getAttributes(signedAssertion);
    assert.equal(2, attributes.length);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
    assert.equal('foo@bar.com', attributes[0].textContent);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
    assert.equal('Foo Bar', attributes[1].textContent);

    assert.equal('urn:issuer', utils.getSaml2Issuer(signedAssertion).textContent);

    var conditions = utils.getConditions(signedAssertion);
    assert.equal(1, conditions.length);
    var notBefore = conditions[0].getAttribute('NotBefore');
    var notOnOrAfter = conditions[0].getAttribute('NotOnOrAfter');
    should.ok(notBefore);
    should.ok(notOnOrAfter);

    var lifetime = Math.round((moment(notOnOrAfter).utc() - moment(notBefore).utc()) / 1000);
    assert.equal(600, lifetime);

    var authnContextClassRef = utils.getAuthnContextClassRef(signedAssertion);
    assert.equal('urn:oasis:names:tc:SAML:2.0:ac:classes:unspecified', authnContextClassRef.textContent);
  });

  it('should set attributes', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
        'http://example.org/claims/testemptyarray': [], // should dont include empty arrays
        'http://example.org/claims/testaccent': 'fóo', // should supports accents
        'http://undefinedattribute/ws/com.com': undefined
      }
    };

    var signedAssertion = saml.create(options);
    
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    var attributes = utils.getAttributes(signedAssertion);
    assert.equal(3, attributes.length);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
    assert.equal('foo@bar.com', attributes[0].textContent);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
    assert.equal('Foo Bar', attributes[1].textContent);
    assert.equal('http://example.org/claims/testaccent', attributes[2].getAttribute('Name'));
    assert.equal('fóo', attributes[2].textContent);
  });

  it('whole thing with specific authnContextClassRef', function () {
    var options = {
      cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
      key: fs.readFileSync(__dirname + '/test-auth0.key'),
      issuer: 'urn:issuer',
      lifetimeInSeconds: 600,
      audiences: 'urn:myapp',
      attributes: {
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar'
      },
      nameIdentifier:       'foo',
      nameIdentifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
      authnContextClassRef: 'specific'
    };

    var signedAssertion = saml.create(options);
    var isValid = utils.isValidSignature(signedAssertion, options.cert);
    assert.equal(true, isValid);

    
    var nameIdentifier = utils.getNameID(signedAssertion);
    assert.equal('foo', nameIdentifier.textContent);
    assert.equal('urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified', nameIdentifier.getAttribute('Format'));

    var attributes = utils.getAttributes(signedAssertion);
    assert.equal(2, attributes.length);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
    assert.equal('foo@bar.com', attributes[0].textContent);
    assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
    assert.equal('Foo Bar', attributes[1].textContent);

    assert.equal('urn:issuer', utils.getSaml2Issuer(signedAssertion).textContent);

    var conditions = utils.getConditions(signedAssertion);
    assert.equal(1, conditions.length);
    var notBefore = conditions[0].getAttribute('NotBefore');
    var notOnOrAfter = conditions[0].getAttribute('NotOnOrAfter');
    should.ok(notBefore);
    should.ok(notOnOrAfter);

    var lifetime = Math.round((moment(notOnOrAfter).utc() - moment(notBefore).utc()) / 1000);
    assert.equal(600, lifetime);

    var authnContextClassRef = utils.getAuthnContextClassRef(signedAssertion);
    assert.equal('specific', authnContextClassRef.textContent);
  });

  describe('encryption', function () {

    it('should create a saml 2.0 signed and encrypted assertion', function (done) {
      var options = {
        cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
        key: fs.readFileSync(__dirname + '/test-auth0.key'),
        encryptionPublicKey: fs.readFileSync(__dirname + '/test-auth0_rsa.pub'),
        encryptionCert: fs.readFileSync(__dirname + '/test-auth0.pem')
      };

      saml.create(options, function(err, encrypted) {
        if (err) return done(err);
        
        xmlenc.decrypt(encrypted, { key: fs.readFileSync(__dirname + '/test-auth0.key')}, function(err, decrypted) {
          if (err) return done(err);
          var isValid = utils.isValidSignature(decrypted, options.cert);
          assert.equal(true, isValid);
          done();
        });
      });
    });

    it('should set attributes', function (done) {
      var options = {
        cert: fs.readFileSync(__dirname + '/test-auth0.pem'),
        key: fs.readFileSync(__dirname + '/test-auth0.key'),
        encryptionPublicKey: fs.readFileSync(__dirname + '/test-auth0_rsa.pub'),
        encryptionCert: fs.readFileSync(__dirname + '/test-auth0.pem'),
        attributes: {
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress': 'foo@bar.com',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name': 'Foo Bar',
          'http://example.org/claims/testaccent': 'fóo', // should supports accents
          'http://undefinedattribute/ws/com.com': undefined
        }
      };

      saml.create(options, function(err, encrypted) {
        if (err) return done(err);
        
        xmlenc.decrypt(encrypted, { key: fs.readFileSync(__dirname + '/test-auth0.key')}, function(err, decrypted) {
          if (err) return done(err);

          var isValid = utils.isValidSignature(decrypted, options.cert);
          assert.equal(true, isValid);

          var attributes = utils.getAttributes(decrypted);
          assert.equal(3, attributes.length);
          assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', attributes[0].getAttribute('Name'));
          assert.equal('foo@bar.com', attributes[0].textContent);
          assert.equal('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', attributes[1].getAttribute('Name'));
          assert.equal('Foo Bar', attributes[1].textContent);
          assert.equal('http://example.org/claims/testaccent', attributes[2].getAttribute('Name'));
          assert.equal('fóo', attributes[2].textContent);

          done();
        });
      });
    });
    
  });

});
