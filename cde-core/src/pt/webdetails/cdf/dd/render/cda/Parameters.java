/*!
 * Copyright 2002 - 2015 Webdetails, a Pentaho company. All rights reserved.
 *
 * This software was developed by Webdetails and is provided under the terms
 * of the Mozilla Public License, Version 2.0, or any later version. You may not use
 * this file except in compliance with the license. If you need a copy of the license,
 * please go to http://mozilla.org/MPL/2.0/. The Initial Developer is Webdetails.
 *
 * Software distributed under the Mozilla Public License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. Please refer to
 * the license for the specific language governing your rights and limitations.
 */

package pt.webdetails.cdf.dd.render.cda;

import java.util.Iterator;

import net.sf.json.JSONArray;
import net.sf.json.JSONObject;
import org.apache.commons.jxpath.JXPathContext;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.apache.commons.lang.StringUtils;

public class Parameters implements CdaElementRenderer {

  private JSONObject definition;
  private final String NAME_ATTR = "name";
  private final String DEFAULT_ATTR = "default";
  private final String TYPE_ATTR = "type";
  private final String ACCESS_ATTR = "access";
  private final String PATTERN_ATTR = "pattern";
  private final String ELEMENT_NAME = "Parameter";

  public void renderInto( Element dataAccess ) {
    JXPathContext.newContext( definition );
    Document doc = dataAccess.getOwnerDocument();
    Element parameters = doc.createElement( "Parameters" );
    dataAccess.appendChild( parameters );
    JSONArray params = JSONArray.fromObject( definition.getString( "value" ) );
    @SuppressWarnings( "unchecked" )
    Iterator<JSONArray> paramIterator = params.iterator();
    while ( paramIterator.hasNext() ) {
      JSONArray param = (JSONArray) paramIterator.next();
      Element parameter = doc.createElement( ELEMENT_NAME );
      parameter.setAttribute( NAME_ATTR, (String) param.get( 0 ) );
      parameter.setAttribute( DEFAULT_ATTR, (String) param.get( 1 ) );
      if ( param.size() > 2 ) {
        parameter.setAttribute( TYPE_ATTR, (String) param.get( 2 ) );
        if ( param.size() > 3 ) {
          String access = (String) param.get( 3 );
          if ( !StringUtils.isEmpty( access ) ) {
            parameter.setAttribute( ACCESS_ATTR, access );
          }
          if ( param.size() > 4 ) {
            String pattern = (String) param.get( 4 );
            if (!StringUtils.isEmpty( pattern ) ) {
              parameter.setAttribute( PATTERN_ATTR, pattern );
            }
          }
        }
      } else {
        parameter.setAttribute( TYPE_ATTR, "String");
      }

      parameters.appendChild( parameter );
    }
  }

  public void setDefinition( JSONObject definition ) {
    this.definition = definition;
  }
}
