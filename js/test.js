test_element_for_text = null;
module( "text_input", {
  setup: function() {
	test_element_for_text = $('<div id="test_element_for_text"></div>');
	$("#playground").append(test_element_for_text);
	first_name = new FormInput({name: "first_name", label: "First Name"});
	birthday = new FormInput({name: "birthday", label: "Birthday", type: "date"});
	first_name.attachTo(test_element_for_text);
	pet_name = new FormInput({name: "pet_name", label: "Pet's Name"});
	pet_type = new FormInput(
								{	name: "pet_type", 
									label: "Kind of Pet", type: "select", 
									options: {
									"cat": "Cat",
									"dog": "Dog"
									}
								}
							);
  }, teardown: function() {
	test_element_for_text.remove();
  }
});

test( "Always true", function() {
	equal(true, true, "true should be true");
});

test( "We can create a container div", function() {
	equal($("#playground").children().length, 1, "There should be 1 child of playground");
});

test( "We can create a text box", function() {
	equal($("#playground").find("input").length, 1, "There should be 1 input as a child of playground");
});

test( "Writing to a textbox will change the value of the model", function() {
	var textbox  = $(first_name.get("view").$el.find("input")[0]);
	textbox.val("My new value");
	textbox.change();
	equal(textbox.val(), first_name.get("value"), "The input should now contain 'My new value'");
});

test( "Date inputs should render input elements with date type in attributes", function() {
	birthday.attachTo(test_element_for_text);
	var bday_view  = $(birthday.get("view").$el.find("input")[0]);
	equal(bday_view.attr('type'), "date", "The input should have rendered date input");
});

test( "Views should return an input element on input() function call", function() {
	var textbox  = first_name.get("view").input();
	equal(textbox.tagName, "INPUT", "Views should return an input element on input() function call");
});

test( "label field on FormInput model is used for the <label> contents", function() {
	equal( 
		first_name.get("view").$el.find("label").text(),
		"First Name",
		"The first_name view should have a label with text: First Name" 
		);
});

test( "groups of inputs can be duplicated (for inputs with variable number of occurences)", function() {
	var inputGroup = new FormInputGroup({"name" : "my input group"});
	inputGroup.createInputSet([pet_name, pet_type]);
	inputGroup.attachTo($('#playground'));
	equal(inputGroup.numRows(), 1, "we should have 1 row now");
	inputGroup.addRow();
	equal(inputGroup.numRows(), 2, "we should have 2 rows now");
});

test( "An input can be dependent on the value of another input", function() {
	var last_name = new FormInput({	"name": "Last name", 
					"dependencyCondition": {
						"field": first_name,
						"operator": "==",
						"value": "Ryan"
					} });
	last_name.attachTo(test_element_for_text);
	var is_visible = $(last_name.get("view").input()).is(":visible");
	equal(is_visible, false, "condition not met, should not be visible");

	first_name.set("value", "Ryan");
	is_visible = $(last_name.get("view").input()).is(":visible");
	equal(is_visible, true, "condition now met, should be visible");
	$(last_name.get("view").input()).remove();
});

test( "An input can be disabled unless a dependency is met", function() {
	var last_name = new FormInput( {"name": "Last name", 
					"disabled": true,
					"dependencyCondition": {
						"field": first_name,
						"operator": "==",
						"value": "Ryan"
					} });
	last_name.attachTo(test_element_for_text);
	var is_visible = $(last_name.get("view").input()).is(":visible");
	equal(is_visible, true, "condition not met, should be visible");

	var is_locked = $(last_name.get("view").input()).attr("disabled") == "disabled";
	equal(is_locked, true, "condition not met, should be locked");

	first_name.set("value", "Ryan");
	is_locked = $(last_name.get("view").input()).attr("disabled") == "disabled";
	equal(is_locked, false, "condition now met, should be unlocked");
	$(last_name.get("view").input()).remove();
});

test( "If an input model has attribute 'hidden' set to true, view should not be visible", function() {
	first_name.set("hidden", true);
	var is_visible  = first_name.get("view").$el.is(":visible");
	equal(is_visible, false);
});

test( "name field on FormInput model is used for the name attribute", function() {
	equal(
		first_name.get("view").$el.find('[name=' + first_name.get('name') + ']').length,
		1,
		"found the name field"
		);
});

test( "If an input model has attribute 'disabled' set to true, view should be disabled", function() {
	first_name.set("disabled", true)
	var disabled  = first_name.get("view").$input().attr("disabled") ;
	equal(disabled, "disabled");
});

test( "Checkbox inputs are supported", function() {
	nice_person = new FormInput({name: "Nice Person", type: "checkbox", value: true});
	nice_person.attachTo(test_element_for_text);
	equal( $(nice_person.get("view").$el.find("input")[0]).attr("type"), "checkbox", "checkbox input type exists");
});

test( "Checkbox model renders checked checkbox if true", function() {
	nice_person = new FormInput({name: "Nice Person", type: "checkbox", value: true});
	nice_person.attachTo(test_element_for_text);
	equal( $(nice_person.get("view").$el.find("input")[0]).is(":checked"), true, "checkbox model has a value of true, so should be checked");
});

test( "Radio inputs are supported", function() {
	var size = new FormInput({name: "Size", type: "radio", 
				options: {
					"s": "Small",
					"m": "Medium",
					"l": "Large"
					} 
				});
	size.attachTo(test_element_for_text);
	equal( $(size.get("view").$el.find("input")[0]).attr("type"), "radio", "radio input type exists");
});

test( "Radio input changes update model values", function() {
	var size = new FormInput({name: "Size", type: "radio", 
				options: {
					"s": "Small",
					"m": "Medium",
					"l": "Large"
					} 
				});
	size.attachTo(test_element_for_text);
	$(size.get("view").$el.find("input")[1]).attr("checked", true)
	$(size.get("view").$el.find("input")[1]).change();
	equal( size.get("value"), "m");
});

test( "Radio model changes, this should update the view", function() {
	var size = new FormInput({name: "Size", type: "radio", 
				options: {
					"s": "Small",
					"m": "Medium",
					"l": "Large"
					} 
				});
	size.attachTo(test_element_for_text);
	size.set("value", "m");
	var is_medium = $(size.get("view").$el.find("input")[1]).attr("checked")
	equal( is_medium, "checked" );
});

test( "SELECT with OPTIONS is supported", function() {
	var size = new FormInput({name: "Size", type: "select", 
				options: {
					"s": "Small",
					"m": "Medium",
					"l": "Large"
					} 
				});
	size.attachTo(test_element_for_text);
	equal( size.get("view").input().tagName, "SELECT");
});

test( "select changes update model values", function() {
	var size = new FormInput({name: "Size", type: "select", 
				options: {
					"s": "Small",
					"m": "Medium",
					"l": "Large"
					} 
				});
	size.attachTo(test_element_for_text);
	$(size.get("view").$el.find("option")[1]).attr("selected", true)
	$(size.get("view").$el.find("select")[0]).change();
	equal( size.get("value"), "m");
});

test( "when select model changes, the view updates", function() {
	var size = new FormInput({name: "Size", type: "select", 
				options: {
					"s": "Small",
					"m": "Medium",
					"l": "Large"
					} 
				});
	size.attachTo(test_element_for_text);
	size.set("value", "m");
	var selected = $(size.get("view").$el.find("option")[1]).attr("selected")
	equal( selected, "selected");
});

module( "fieldset", {
  setup: function() {
	test_element_for_text = $('<div id="test_element_for_text"></div>');
	$("#playground").append(test_element_for_text);
	first_name = new FormInput({name: "First name"});
	first_name.attachTo(test_element_for_text);
  }, teardown: function() {
	test_element_for_text.remove();
  }
});

test( "fieldsets exist", function() {
	var test_fieldset = new FormFieldSet({name: "test field set"});
	equal(true, true, "No exception was raised");	
});

test( "fieldsets can contain inputs", function() {
	var test_fieldset = new FormFieldSet({name: "test field set"});
	test_fieldset.addInput(first_name);
	equal(true, true, "No exception was raised");	
});

test( "inputs changes bubble up to fieldsets", function() {
	fieldset_bubbling = false;
	var test_fieldset = new FormFieldSet({name: "test field set"});
	test_fieldset.addInput(first_name);
	test_fieldset.on('inputUpdated', function() { fieldset_bubbling = true; } );
	first_name.set("value", "Robert");
	equal(fieldset_bubbling, true, "The fieldset should have gotten a change bubble up from first_name");	
});

test( "fieldsets can render inputs", function() {
	var test_fieldset = new FormFieldSet({name: "test field set"});
	test_fieldset.addInput(first_name);
	test_fieldset.attachTo("#test_element_for_text");
	equal(true, true, "No exception was raised");	
});

test( "fieldsets can hide their views if set('hidden', true) is called", function() {
	var test_fieldset = new FormFieldSet({name: "test field set"});
	test_fieldset.addInput(first_name);
	test_fieldset.attachTo("#test_element_for_text");
	test_fieldset.set('hidden', true);
	var is_visible = $(test_fieldset.view.el).is(":visible");
	equal(is_visible, false, "condition met, should not be visible");
});

module( "Form Tests", {
  setup: function() {
	test_element_for_text = $('<div id="test_element_for_text"></div>');
	$("#playground").append(test_element_for_text);
	first_name = new FormInput({name: "First name"});
	last_name = new FormInput({name: "Last name"});
	test_fieldset = new FormFieldSet({name: "test field set"});
	test_fieldset.addInput(first_name);
	test_fieldset2 = new FormFieldSet({name: "test field set2"});
	test_fieldset2.addInput(last_name);
  }, teardown: function() {
	test_element_for_text.remove();
  }
});

test( "forms can render inputs", function() {
	var test_form = new Form({name: "test form", action: "action"});
	test_form.addInput(test_fieldset);
	test_form.attachTo("#test_element_for_text");
	equal(true, true, "No exception was raised");
});

    test( "forms can hide all fieldsets with hideAll()", function() {
	var test_form = new Form({name: "test form", action: "action"});
	test_form.addInput([test_fieldset, test_fieldset2]);
	test_form.attachTo("#test_element_for_text");
	test_form.hideAll();
	var visible_elements = test_form.view.$el.children().find('fieldset:visible');
	equal(visible_elements.length, 0, "No visible elements of form");	
    });

test( "forms can show a single fieldset with showOneFieldset(index)", function() {
	var test_form = new Form({name: "test form", action: "action"});
	test_form.addInput([test_fieldset, test_fieldset2]);
	test_form.attachTo("#test_element_for_text");
	test_form.showOneFieldset(0);
	var visible_elements = test_form.view.$el.children().find('fieldset:visible');
	equal(visible_elements.length, 1, "One single visible fieldset of form");	
});

test( "inputs changes bubble up to forms", function() {
	fieldset_bubbling = false;
	var test_form = new Form({name: "test form", action: "action"});
	test_form.addInput([test_fieldset, test_fieldset2]);
	test_form.on('inputUpdated', function() { fieldset_bubbling = true; } );
	first_name.set("value", "Robert");
	equal(fieldset_bubbling, true, "The form should have gotten a change bubble up from first_name");	
});
module( "wizard tests", {
  setup: function() {
	test_element_for_text = $('<div id="test_element_for_text"></div>');
	$("#playground").append(test_element_for_text);
	first_name = new FormInput({name: "First name"});
	last_name = new FormInput({name: "Last name"});
	description = new FormFieldSet({name: "Description"});
	description.addInput([first_name, last_name]);
	phone = new FormInput({name: "Phone Number"});
	address = new FormInput({name: "Address"});
	contact = new FormFieldSet({name: "contact"});
	contact.addInput([address, phone]);
	form = new Form();
	form.addInput([description, contact]);
  }, teardown: function() {
	test_element_for_text.remove();
  }
});
test( "wizard can use a form for gathering input", function() {
	var wizard = new FormWizard(form);
	equal(true, true, "No exception was raised");	
});

test( "wizard renders a forward button", function() {
	var wizard = new FormWizard({"form": form});
	wizard.attachTo(test_element_for_text);
	equal( wizard.get("view").$el.find(".wizard-forward-button").length,
		1,
		"Found the forward button element");
});

test( "wizard can return a numberOfSteps value", function() {
	var wizard = new FormWizard({"form": form});
	equal( wizard.numberOfSteps(), 2, "Should be 2 steps in this wizard");
});

test( "wizard has one active fieldset", function() {
	var wizard = new FormWizard({"form": form});
	wizard.attachTo(test_element_for_text);
	equal( wizard.getActiveFieldSet(), description, "The active fieldset should default to the first fieldset");
});

test( "wizard starts with first fieldset visible, rest hidden", function() {
	var wizard = new FormWizard({"form": form});
	wizard.attachTo(test_element_for_text);
	equal( description.view.$el.is(":visible"), true, "description fieldset should be visible");
	equal( contact.view.$el.is(":visible"), false, "contact fieldset should not be visible");
});

test( "wizard starts with Previous not visible", function() {
	var wizard = new FormWizard({"form": form});
	wizard.attachTo(test_element_for_text);
	var prev_button_visible = (wizard.get('view').$el.find(".wizard-previous-button").is(":visible"));
	equal( prev_button_visible, false, "contact fieldset should not be visible");
});

test( "file upload inputs should be supported", function() {
	fail("not implemented ");
});

test( "input validation should be supported", function() {
	fail("not implemented ");
});

test( "persistence should be implemented with ability to send json", function() {
	fail("not implemented ");
});

test( "persistence should be implemented with ability to retrieve json", function() {
	fail("not implemented ");
});
