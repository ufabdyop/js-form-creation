/**
 * MODELS: Here we are defining all the models in the MVC structure
 * ----------------------------------------------------------------
 * 
 */
var null_input_model = Backbone.Model.extend({
			defaults: {} 
		});

//a simple wrapper type of object that always shows the dependent input
var null_form_condition = Backbone.Model.extend({
			defaults: { "subject" : new null_input_model() } ,
			evaluate: function(dependent) {
				dependent.show();
			}
		});

var form_condition = Backbone.Model.extend({
	defaults: {
		"subject": new null_input_model(),    //a FormInput
		"comparison": "==", // '==', '!=', '<', '>', etc.
		"object": null,     //probably a string
		"required": false,  //should the caller be required if comparison is true?
		"display": "hide",  //display mode: hide or lock (just like jformer)
	},
	
	//dependent needs to have show, hide, lock, unlock methods
	evaluate: function(dependent) {
		var sub = this.get('subject').get('value');
		var comp = this.get('comparison');
		var obj = this.get('object'); 
		var evaluation_string = 'sub ' + comp + ' obj' ;
		var should_be_shown = eval( evaluation_string );
		var mode = this.get('display');
		if (should_be_shown == true) {
			if (mode == 'hide') {
				dependent.show();
			}
			if (mode == 'lock') {
				dependent.unlock();
			}
		} else {
			if (mode == 'hide') {
				dependent.hide();
			}
			if (mode == 'lock') {
				dependent.lock();
			}
		}
	}
});

/**
 * form input
 */
var FormInput = Backbone.Model.extend({
	defaults: {
		id: false,
		long_label: false,
		type: 'text',
		name: '',
		label: '',
		form: null,
		fieldset: null,
		value: '',
		options: [],
		default_value: '', 
		view: null,
		dependsOn: new null_form_condition()	,
		disabled: false,
		hidden: false
	},
	initialize: function(attributes) {
		var array_version = this.get('dependsOn');
		this.set('dependsOn', new form_condition(array_version));
	},
	renderTo: function(element) {
		var view = new input_view({model: this, element: element});
		this.set('view', view);
		this.get('dependsOn').get('subject').on('input change', view.render, view);
	}
});

/**
 * TEMPLATES:
 * ---------------------------
 *
 * */
var templates = { 
			text:  _.template('<div class="text_input" id="container_for_<%=id%>"> \n' + 
					'<label for="<%=id %>"><%=name %><input type="text" value="<%=value%>" name="<%=name %>" id="text_<%=id %>"/></label> \n' +
				'</div>\n')
		};


/**
 * VIEWS:
 * ------------------------------------------------
 */
    var input_view = Backbone.View.extend({
        model: FormInput,
        tagName: 'div',
        template: null,
        initialize: function(attributes) {
          this.model.on('change', this.render, this);

	  var model_type = this.model.get('type');
	  this.template = templates[model_type];

          $(attributes.element).append(this.el);
          this.render();  
        },
        render: function() {
            var markup = this.template({
                                        id: this.model.get('id'),
                                        value: this.model.get('value'),
                                        name: this.model.get('name')
                                    });
	    this.$el.html(markup);
	    this.model.get('dependsOn').evaluate(this);
        },
	$input: function() {
		return $(this.input());
	},
	input: function() {
		return this.$el.find('input')[0];
	},
	show: function() {
		this.unlock();
		this.$el.show();
	},
	hide: function() {
		this.lock();
		this.$el.hide();
	},
	lock: function() {
		this.$input().attr('disabled', 'true');
	},
	unlock: function() {
		this.$input().removeAttr('disabled');
	},
	update_model: function() {
		this.model.off('change', this.render, this);
		this.model.set('value', this.$el.find('input').first().val());
		this.model.on('change', this.render, this);
	},
	events: {
		"change input" : "update_model",
		"keyup input" : "update_model"
	}
    });
